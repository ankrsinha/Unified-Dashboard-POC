import { fetchRepositories, fetchTrackingTrends, type Repository, type TrendPoint } from "../api/client";
import { buildTrendsFromRepos, mergeTrendPoints } from "./buildTrendsFromRepos";

export type ReposLoadArg = { aiMode: boolean };

export type ReposLoadState = {
  repos: Repository[];
  org: string;
  error: string | null;
};

export const initialReposState: ReposLoadState = {
  repos: [],
  org: "tektoncd",
  error: null,
};

export async function loadRepos(
  _previous: ReposLoadState,
  { aiMode }: ReposLoadArg,
): Promise<ReposLoadState> {
  try {
    const data = await fetchRepositories({ aiMode });
    return {
      repos: data.repositories,
      org: data.organization,
      error: null,
    };
  } catch (err) {
    return {
      repos: [],
      org: "tektoncd",
      error: err instanceof Error ? err.message : "Failed to load repositories",
    };
  }
}

export type TrendsLoadArg = { aiMode: boolean; repos: Repository[] };

export type TrendsLoadState = {
  trendPoints: TrendPoint[];
  trendsWarning: string | null;
};

export const initialTrendsState: TrendsLoadState = {
  trendPoints: [],
  trendsWarning: null,
};

/** Runs after repos are cached on the server so /tracking/trends can reuse the repo list. */
export async function loadTrends(
  _previous: TrendsLoadState,
  { aiMode, repos }: TrendsLoadArg,
): Promise<TrendsLoadState> {
  const localTrends = buildTrendsFromRepos(repos);
  if (repos.length === 0) {
    return { trendPoints: localTrends, trendsWarning: null };
  }

  try {
    const trendsData = await fetchTrackingTrends({ aiMode });
    return {
      trendPoints: mergeTrendPoints(trendsData.points, localTrends),
      trendsWarning: trendsData.partial
        ? trendsData.message ??
          "Some monthly PR and issue counts may be missing due to GitHub search limits."
        : null,
    };
  } catch {
    return {
      trendPoints: localTrends,
      trendsWarning:
        "Could not load monthly PR and issue trends from GitHub. Repository and star trends are still shown.",
    };
  }
}
