export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  language?: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  open_pull_requests_count?: number;
  archived: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TrendPoint {
  month: string;
  repos: number;
  stars: number;
  open_prs: number;
  open_issues: number;
}

export interface TrackingTrendsResponse {
  organization: string;
  points: TrendPoint[] | null;
  partial?: boolean;
  message?: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: string[];
  created_at?: string;
  comments: number;
}

export interface TrackingMetrics {
  good_first_issues: number;
  open_bugs: number;
  linked_bugs: number;
  pending_prs: number;
  dependency_alerts: number;
  ci_failure_rate: number;
  avg_ci_minutes: number;
  workflow_runs_sampled: number;
}

export interface RepoMetricPoint {
  repository: string;
  metrics: TrackingMetrics;
}

export interface MonthlyBucket {
  month: string;
  count: number;
}

export interface PullRequestItem {
  id: number;
  number: number;
  title: string;
  html_url: string;
  created_at?: string;
}

export interface CategoryInsight {
  key: string;
  label: string;
  total: number;
  monthly: MonthlyBucket[];
  issues?: Issue[];
  pull_requests?: PullRequestItem[];
}

export interface RepoInsights {
  repository: string;
  metrics: TrackingMetrics;
  categories: CategoryInsight[];
}

interface RepositoriesResponse {
  organization: string;
  count: number;
  repositories: Repository[];
}

interface GoodFirstIssuesResponse {
  repository: string;
  count: number;
  issues: Issue[] | null;
}

interface TrackingSummaryResponse {
  organization: string;
  summary: TrackingMetrics;
  by_repository: RepoMetricPoint[] | null;
}

interface RepoTrackingResponse {
  repository: string;
  metrics: TrackingMetrics;
}

function normalizeIssues(issues: Issue[] | null | undefined): Issue[] {
  return Array.isArray(issues) ? issues : [];
}

function normalizeBreakdown(points: RepoMetricPoint[] | null | undefined): RepoMetricPoint[] {
  return Array.isArray(points) ? points : [];
}

export type FetchResult<T> = {
  data: T;
  fromCache: boolean;
};

type FetchOptions = {
  refresh?: boolean;
};

function withRefresh(path: string, refresh?: boolean) {
  if (!refresh) return path;
  return `${path}${path.includes("?") ? "&" : "?"}refresh=true`;
}

async function getJSON<T>(path: string, options?: FetchOptions): Promise<FetchResult<T>> {
  const res = await fetch(withRefresh(path, options?.refresh));
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  const fromCache = res.headers.get("X-Cache") === "HIT";

  if (!res.ok) {
    throw new Error(body || `Request failed: ${res.status}`);
  }
  if (!contentType.includes("application/json")) {
    throw new Error("API returned non-JSON. Is the Go backend running on port 8081?");
  }
  return { data: JSON.parse(body) as T, fromCache };
}

export async function fetchRepositories(options?: FetchOptions) {
  const { data } = await getJSON<RepositoriesResponse>("/api/repositories", options);
  return data;
}

function normalizeTrendPoints(points: TrendPoint[] | null | undefined): TrendPoint[] {
  return Array.isArray(points) ? points : [];
}

export async function fetchTrackingTrends(options?: FetchOptions) {
  const { data } = await getJSON<TrackingTrendsResponse>("/api/tracking/trends", options);
  return {
    organization: data.organization,
    points: normalizeTrendPoints(data.points),
    partial: Boolean(data.partial),
    message: data.message,
  };
}

export async function fetchTrackingSummary(options?: FetchOptions) {
  const { data } = await getJSON<TrackingSummaryResponse>("/api/tracking/summary", options);
  return {
    organization: data.organization,
    summary: data.summary,
    byRepository: normalizeBreakdown(data.by_repository),
  };
}

export async function fetchRepoTracking(owner: string, name: string, options?: FetchOptions) {
  const { data } = await getJSON<RepoTrackingResponse>(
    `/api/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/tracking`,
    options,
  );
  return data;
}

function normalizeCategories(categories: CategoryInsight[] | null | undefined): CategoryInsight[] {
  if (!Array.isArray(categories)) return [];
  return categories.map(c => ({
    ...c,
    monthly: Array.isArray(c.monthly) ? c.monthly : [],
    issues: Array.isArray(c.issues) ? c.issues : undefined,
    pull_requests: Array.isArray(c.pull_requests) ? c.pull_requests : undefined,
  }));
}

export async function fetchRepoInsights(owner: string, name: string, options?: FetchOptions) {
  const result = await getJSON<RepoInsights>(
    `/api/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/insights`,
    options,
  );
  return {
    ...result,
    data: {
      ...result.data,
      categories: normalizeCategories(result.data.categories),
    },
  };
}

export async function fetchGoodFirstIssues(owner: string, name: string, options?: FetchOptions) {
  const { data } = await getJSON<GoodFirstIssuesResponse>(
    `/api/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/good-first-issues`,
    options,
  );
  const issues = normalizeIssues(data.issues);
  return {
    repository: data.repository,
    count: data.count ?? issues.length,
    issues,
  };
}
