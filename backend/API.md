# Unified Dashboard API

Go HTTP API (default **http://localhost:8081**) that proxies and aggregates [GitHub](https://docs.github.com/en/rest) data for a configured organization. The React frontend calls these routes under `/api/*` (dev server proxies to the backend).

## Configuration

| Variable | Purpose |
| -------- | ------- |
| `GITHUB_TOKEN` | Personal access token. Strongly recommended — raises rate limits and enables GraphQL release enrichment. |
| `GITHUB_ORG` | Organization login (default `tektoncd`). Used by `GET /api/repositories` and org-wide tracking routes. |
| `GEMINI_API_KEY` | Enables **AI mode** issue complexity classification (see below). |
| `PORT` | Listen port (default `8081`). |
| `CORS_ORIGINS` | Comma-separated allowed browser origins. |
| `CACHE_TTL_MINUTES` | In-memory response cache TTL (default `15`). |

Without `GITHUB_TOKEN`, unauthenticated limits apply (~60 REST requests/hour). Without `GEMINI_API_KEY`, `ai_mode=true` is accepted but complexity is not added.

## Common behavior

### Query parameters

| Parameter | Values | Effect |
| --------- | ------ | ------ |
| `refresh` | `true` | Deletes the server cache entry for that route, then refetches from GitHub. |
| `ai_mode` | `true` | On supported routes, runs Gemini issue-complexity enrichment before caching (requires `GEMINI_API_KEY`). |

Example: `GET /api/repositories/tektoncd/pipeline/insights?refresh=true&ai_mode=true`

### Response headers

| Header | Meaning |
| ------ | ------- |
| `X-Cache: HIT` | Body served from in-memory cache (within TTL). |
| `X-Cache: MISS` | Fresh fetch from GitHub (and optional LLM). |
| `Content-Type: application/json` | All successful JSON responses. |

### Errors

Non-2xx responses are JSON:

```json
{ "error": "human-readable message" }
```

Typical status codes: `400` (bad path params), `405` (`/api/hello` only), `502` (GitHub or upstream failure).

---

## Endpoints

### Health & smoke

#### `GET /api/health`

Liveness and dependency hints.

**Response**

```json
{
  "status": "ok",
  "github_authenticated": true,
  "cache_ttl_minutes": 15,
  "cache_entries": 3
}
```

#### `GET /api/hello` · `PUT /api/hello`

Smoke test; returns a short JSON greeting.

---

### Repositories

#### `GET /api/repositories`

Lists repositories for `GITHUB_ORG`.

**Cache key:** `repos:{org}`

**Upstream:** GitHub REST `ListByOrg`, per-repo open PR counts (REST), optional GraphQL **release-only** enrichment (`EnrichRepositoryReleases` — latest release tag/date/URL and open PR total fallback when REST count is zero).

**Response**

```json
{
  "organization": "tektoncd",
  "count": 42,
  "repositories": [
    {
      "id": 123,
      "name": "pipeline",
      "full_name": "tektoncd/pipeline",
      "description": "...",
      "html_url": "https://github.com/tektoncd/pipeline",
      "language": "Go",
      "stargazers_count": 1000,
      "forks_count": 200,
      "open_issues_count": 50,
      "open_pull_requests_count": 12,
      "last_release_at": "2025-01-15T12:00:00Z",
      "last_release_tag": "v0.65.0",
      "last_release_url": "https://github.com/.../releases/tag/v0.65.0",
      "archived": false,
      "created_at": "2018-07-30T...",
      "updated_at": "2025-05-01T..."
    }
  ]
}
```

**Note:** Stale PR/issue counts are **not** on the list API. They are computed when a repository accordion calls `/insights` (see below).

#### `GET /api/organizations/{org}/repositories`

Same as above for an arbitrary `{org}` path parameter.

---

### Per-repository

#### `GET /api/repositories/{owner}/{name}/insights`

Workload breakdown for charts and the expandable insight panel. Fetched when a repo row is expanded (not on initial list load).

**Cache key:** `insights:{owner}/{name}` or `insights:ai:{owner}/{name}` when `ai_mode=true`

**Upstream:** GitHub REST — good-first issues, bug-labeled issues, open PRs, open issues, Dependabot alert count, workflow run metrics, latest release. Stale PRs/issues are derived in-process (no separate GraphQL list call).

**Response**

```json
{
  "repository": "tektoncd/pipeline",
  "metrics": {
    "good_first_issues": 5,
    "open_bugs": 12,
    "linked_bugs": 3,
    "pending_prs": 8,
    "dependency_alerts": 2,
    "ci_failure_rate": 0.15,
    "avg_ci_minutes": 12.5,
    "workflow_runs_sampled": 20
  },
  "categories": [
    {
      "key": "good_first_issues",
      "label": "Good first issues",
      "total": 5,
      "monthly": [{ "month": "2025-03", "count": 2 }],
      "issues": [{ "id": 1, "number": 42, "title": "...", "html_url": "...", "state": "open", "labels": [], "created_at": "...", "updated_at": "...", "comments": 0, "complexity": "beginner" }]
    }
  ],
  "latest_release": {
    "tag": "v0.65.0",
    "published_at": "2025-01-15T12:00:00Z",
    "url": "https://github.com/..."
  }
}
```

**Category keys**

| `key` | Contents |
| ----- | -------- |
| `good_first_issues` | Issues with beginner-friendly labels |
| `open_bugs` | Open issues with bug-style labels |
| `linked_bugs` | Bug issues whose body references other issues/PRs |
| `pending_prs` | Open pull requests |
| `stale_prs` | Open PRs with no update for **30+ days** |
| `stale_issues` | Open issues (non-PR) with no update for **30+ days** |
| `dependency_alerts` | Dependabot alert count (single current bucket) |

`monthly` buckets use `YYYY-MM` (UTC). Issue/PR items include `created_at` / `updated_at` for chart drill-down and month filters in the UI.

#### `GET /api/repositories/{owner}/{name}/good-first-issues`

Dedicated good-first-issue list (same label search as insights). Supports `ai_mode` for per-issue `complexity`.

**Cache key:** `good-first-issues:{owner}/{name}` (or `...:ai:...`)

**Response**

```json
{
  "repository": "tektoncd/pipeline",
  "count": 5,
  "issues": [ /* Issue objects */ ]
}
```

Used by the API client; the main dashboard uses `/insights` instead.

#### `GET /api/repositories/{owner}/{name}/tracking`

Per-repo tracking metrics (search/REST aggregation).

**Cache key:** `tracking:{owner}/{name}`

**Response**

```json
{
  "repository": "tektoncd/pipeline",
  "metrics": { /* TrackingMetrics — same shape as insights.metrics */ }
}
```

---

### Organization tracking

#### `GET /api/tracking/summary`

Org-wide counts via GitHub **search** API (good-first issues, open bugs, open PRs), plus a breakdown for up to five starred repos.

**Cache key:** `tracking-summary:{org}`

**Response**

```json
{
  "organization": "tektoncd",
  "summary": {
    "good_first_issues": 100,
    "open_bugs": 80,
    "linked_bugs": 0,
    "pending_prs": 200,
    "dependency_alerts": 0,
    "ci_failure_rate": 0.1,
    "avg_ci_minutes": 15,
    "workflow_runs_sampled": 0
  },
  "by_repository": [
    { "repository": "tektoncd/pipeline", "metrics": { /* TrackingMetrics */ } }
  ]
}
```

Exposed in the frontend client; not wired into the current dashboard home view.

#### `GET /api/tracking/trends`

Monthly activity series for dashboard stat cards (last **6** months, UTC).

**Cache key:** `tracking-trends:{org}`

**Depends on:** Cached repo list from `GET /api/repositories` when available (avoids a second full org list call). The dashboard refetches trends after repos load so PR/issue search can use that cache. `partial` / `message` apply only when GitHub search limits affect monthly PR/issue counts.

**Response**

```json
{
  "organization": "tektoncd",
  "points": [
    {
      "month": "2024-12",
      "repos": 2,
      "stars": 150,
      "open_prs": 45,
      "open_issues": 30
    }
  ],
  "partial": false,
  "message": "optional human-readable note when partial"
}
```

---

## How trends work

Trends power the **dashboard stat cards** (sparklines, period-over-period chips, detail dialog). There is no LLM involved in trends.

### Backend (`GET /api/tracking/trends`)

Implementation: `internal/github/trends.go` → `OrgTrends`.

For each of the last 6 calendar months (`YYYY-MM`, UTC):

| Field | Source | Meaning |
| ----- | ------ | ------- |
| `repos` | Repo `created_at` from cached org list | Count of repositories **created** in that month |
| `stars` | Sum of `stargazers_count` for repos created that month | Not historical star growth — stars attributed to creation month |
| `open_prs` | GitHub search: `org:{org} is:pr created:{start}..{end}` | PRs **opened** in that month |
| `open_issues` | GitHub search: `org:{org} is:issue created:{start}..{end}` | Issues **opened** in that month (excludes PRs in search semantics) |

Search calls are paced (400ms authenticated, 1s unauthenticated). On rate limit or search failure, affected months may be zero and `partial: true` is set.

### Frontend merge & fallbacks

React Query (`Dashboard.tsx`):

1. `GET /api/repositories` and `GET /api/tracking/trends` run in parallel
2. After repos succeed, trends is invalidated once so the server can reuse the cached repo list for PR/issue search
3. **Merge:** API points win; if `repos`/`stars` are zero for a month, fill from client-side buckets built from the repo list
4. If trends fails, use **local-only** monthly buckets and set `trendsWarning`; if `partial: true`, show the banner only after the latest trends fetch settles

Open PR counts on the repo list come from **GraphQL release enrichment** (not per-repo REST calls), so the repositories endpoint stays within proxy timeouts.

**Yearly repos/stars** (stat cards for total repositories / stars) are computed **only in the browser** via `buildYearlyTrendsFromRepos()` — one bucket per year from earliest `created_at` through the current year. They do not call a separate API.

**Headline stat numbers** on cards are **current snapshots** (e.g. total repos now). **Charts and trend chips** compare the last two periods in the series (month or year depending on the card).

---

## AI integration

AI mode is **optional** and controlled by the UI toggle (`AiModeContext` → `localStorage` `aiMode`). When enabled, the frontend appends `ai_mode=true` to fetches.

### What it does

When `ai_mode=true` **and** `GEMINI_API_KEY` is set:

1. After GitHub data is loaded for a supported route, the handler collects issue title/body text.
2. `internal/llm` calls **Google Gemini** (`gemini-2.0-flash`) to classify each issue as:
   - `beginner`
   - `intermediate`
   - `advanced`
3. Results are written to `complexity` on each issue in the JSON response.

Context sent to the model per batch:

- Repository description (REST)
- README content (truncated to 4000 chars)
- Issue title + body (body truncated to 500 chars per issue)

### Supported routes

| Route | AI cache key suffix |
| ----- | ------------------- |
| `GET .../insights` | `insights:ai:{owner}/{name}` |
| `GET .../good-first-issues` | `good-first-issues:ai:{owner}/{name}` |

If the LLM fails, the handler logs the error and returns insights **without** complexity rather than failing the whole request.

### Batching & LLM cache

`AnalyzeIssueComplexity` (`internal/llm/llm.go`):

- Issues sorted by number, split into batches of **25**
- Each batch fingerprinted (repo context hash + issue content hash)
- **In-memory batch cache** (2-hour TTL): unchanged batches skip Gemini entirely
- Batches run concurrently on cache miss

This is separate from the HTTP response cache (`CACHE_TTL_MINUTES`).

### What AI does **not** do

- Trends, search counts, stale detection, or release metadata
- Summaries or natural-language insights in the UI
- Any call on `GET /api/repositories` or `GET /api/tracking/*`

Complexity chips appear in the repository insight accordion when AI mode is on and the backend returns `complexity` on issues.

---

## Frontend API client

TypeScript wrappers: `frontend/src/api/client.ts`

| Function | Endpoint |
| -------- | -------- |
| `fetchRepositories` | `GET /api/repositories` |
| `fetchTrackingTrends` | `GET /api/tracking/trends` |
| `fetchTrackingSummary` | `GET /api/tracking/summary` |
| `fetchRepoTracking` | `GET /api/repositories/{owner}/{name}/tracking` |
| `fetchRepoInsights` | `GET /api/repositories/{owner}/{name}/insights` |
| `fetchGoodFirstIssues` | `GET /api/repositories/{owner}/{name}/good-first-issues` |

All accept `{ refresh?: boolean; aiMode?: boolean }` and return `{ data, fromCache }` where applicable (`X-Cache` header).

---

## External services summary

| Service | Used for |
| ------- | -------- |
| GitHub REST | Repo list, issues, PRs, releases, workflows, Dependabot |
| GitHub Search | Org/month PR & issue counts, org tracking summary |
| GitHub GraphQL | Latest release (+ open PR total fallback) on repo list only |
| Google Gemini | Issue `complexity` when `ai_mode=true` |

---

## Route index

| Method | Path |
| ------ | ---- |
| GET | `/api/health` |
| GET, PUT | `/api/hello` |
| GET | `/api/repositories` |
| GET | `/api/organizations/{org}/repositories` |
| GET | `/api/repositories/{owner}/{name}/good-first-issues` |
| GET | `/api/repositories/{owner}/{name}/tracking` |
| GET | `/api/repositories/{owner}/{name}/insights` |
| GET | `/api/tracking/summary` |
| GET | `/api/tracking/trends` |
