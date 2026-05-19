import { useEffect, useRef, useState } from "react";
import { fetchRepositories, fetchTrackingTrends, type Repository, type TrendPoint } from "../api/client";
import { buildTrendsFromRepos, mergeTrendPoints } from "../dashboard/buildTrendsFromRepos";

/**
 * Loads repos and trends in parallel. Each slice updates state as soon as its fetch
 * completes (no useActionState / startTransition batching).
 */
export function useDashboardData(aiMode: boolean) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [org, setOrg] = useState("Tektoncd");
  const [reposPending, setReposPending] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [trendsWarning, setTrendsWarning] = useState<string | null>(null);
  const [trendsPending, setTrendsPending] = useState(true);
  const reposRef = useRef<Repository[]>([]);

  useEffect(() => {
    let cancelled = false;
    reposRef.current = [];

    setReposPending(true);
    setReposError(null);
    setTrendsPending(true);
    setTrendsWarning(null);

    void fetchRepositories({ aiMode })
      .then(data => {
        if (cancelled) return;
        reposRef.current = data.repositories;
        setRepos(data.repositories);
        setOrg(data.organization);
        setReposPending(false);
        setTrendPoints(prev => mergeTrendPoints(prev, buildTrendsFromRepos(data.repositories)));
      })
      .catch(err => {
        if (cancelled) return;
        setReposError(err instanceof Error ? err.message : "Failed to load repositories");
        setReposPending(false);
      });

    void fetchTrackingTrends({ aiMode })
      .then(trendsData => {
        if (cancelled) return;
        const local = buildTrendsFromRepos(reposRef.current);
        setTrendPoints(mergeTrendPoints(trendsData.points, local));
        setTrendsWarning(
          trendsData.partial
            ? trendsData.message ??
              "Some monthly PR and issue counts may be missing due to GitHub search limits."
            : null,
        );
        setTrendsPending(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTrendPoints(buildTrendsFromRepos(reposRef.current));
        setTrendsWarning(
          "Could not load monthly PR and issue trends from GitHub. Repository and star trends are still shown.",
        );
        setTrendsPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [aiMode]);

  return {
    repos,
    org,
    reposPending,
    reposError,
    trendPoints,
    trendsPending,
    trendsWarning,
  };
}
