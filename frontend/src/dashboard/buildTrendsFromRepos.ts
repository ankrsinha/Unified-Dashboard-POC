import type { Repository, TrendPoint } from "../api/client";

const TREND_MONTHS = 6;

/** Client-side repos/stars buckets when the trends API is unavailable. */
export function buildTrendsFromRepos(repositories: Repository[]): TrendPoint[] {
  const now = new Date();
  const buckets: TrendPoint[] = [];

  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({ month, repos: 0, stars: 0, open_prs: 0, open_issues: 0 });
  }

  for (const repo of repositories) {
    if (!repo.created_at) continue;
    const created = new Date(repo.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const key = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.find(b => b.month === key);
    if (!bucket) continue;
    bucket.repos += 1;
    bucket.stars += repo.stargazers_count ?? 0;
  }

  return buckets;
}

export function mergeTrendPoints(api: TrendPoint[], fromRepos: TrendPoint[]): TrendPoint[] {
  if (api.length === 0) return fromRepos;
  const repoByMonth = new Map(fromRepos.map(p => [p.month, p]));
  return api.map(p => {
    const local = repoByMonth.get(p.month);
    return {
      ...p,
      repos: p.repos > 0 ? p.repos : (local?.repos ?? 0),
      stars: p.stars > 0 ? p.stars : (local?.stars ?? 0),
    };
  });
}
