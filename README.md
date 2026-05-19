# Unified Dashboard

A dashboard for the [tektoncd](https://github.com/tektoncd) GitHub organization: repository list, upstream tracking (good first issues, bugs, PRs, CI metrics), and charts. The frontend is React + MUI; the backend is Go and proxies the GitHub API.

## Prerequisites

- [Go](https://go.dev/dl/) 1.23+
- [Bun](https://bun.sh/) 1.1+
- GitHub [personal access token](https://github.com/settings/tokens) (recommended) with `public_repo` read access

Without a token the API is limited to **60 requests/hour** and will rate-limit quickly.

## Quick start (local)

### 1. Clone and configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set your token:

```env
GITHUB_TOKEN=ghp_your_token_here
```

Do not commit `.env` — it is gitignored.

### 2. Start the API (terminal 1)

```bash
cd backend
make run
```

The server listens on **http://localhost:8081** by default. On startup you should see `GITHUB_TOKEN loaded` and rate-limit info in the logs.

Check health: [http://localhost:8081/api/health](http://localhost:8081/api/health)

### 3. Start the frontend (terminal 2)

```bash
cd frontend
bun install
bun dev
```

Open the URL printed in the terminal (usually **http://localhost:3000**). The dev server proxies `/api/*` to the Go backend.

If the backend uses another port:

```bash
BACKEND_URL=http://localhost:8081 bun dev
```

## Docker Compose (ignore this for now - not verified)

From the repo root:

```bash
cp backend/.env.example backend/.env   # add GITHUB_TOKEN
docker compose -f deploy/docker-compose.yml up --build
```

App: [http://localhost:8080](http://localhost:8080)

## Project layout

```
backend/          Go API (GitHub client, cache, tracking)
frontend/         React + MUI UI (Bun dev server)
deploy/           Docker, Kubernetes/OpenShift, Tekton pipeline
```

## API documentation

Full endpoint reference, trends behavior, and AI mode: **[backend/API.md](backend/API.md)**.

Quick links: `GET /api/health`, `GET /api/repositories`, `GET /api/repositories/{owner}/{name}/insights`, `GET /api/tracking/trends`. Append `?refresh=true` to bypass cache; `?ai_mode=true` enables Gemini issue complexity (requires `GEMINI_API_KEY`).

## Deployment (ignore this for now - not verified)

See [deploy/README.md](deploy/README.md) for OpenShift, Kubernetes, and Tekton.
