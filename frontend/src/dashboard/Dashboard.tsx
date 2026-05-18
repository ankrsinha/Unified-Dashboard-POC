import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useEffect, useState } from "react";
import { fetchRepositories, fetchTrackingTrends, type Repository, type TrendPoint } from "../api/client";
import { buildTrendsFromRepos, mergeTrendPoints } from "./buildTrendsFromRepos";
import { DashboardLayout } from "./DashboardLayout";
import { DashboardStats } from "./DashboardStats";
import { Header } from "./Header";
import { RepositoriesTable } from "./RepositoriesTable";

export function Dashboard() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [org, setOrg] = useState("tektoncd");
  const [loading, setLoading] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsWarning, setTrendsWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setTrendsLoading(true);
    setReposError(null);
    setTrendsWarning(null);

    fetchRepositories()
      .then(async reposData => {
        if (cancelled) return;
        setRepos(reposData.repositories);
        setOrg(reposData.organization);
        setLoading(false);

        const localTrends = buildTrendsFromRepos(reposData.repositories);

        try {
          const trendsData = await fetchTrackingTrends();
          if (cancelled) return;
          setTrendPoints(mergeTrendPoints(trendsData.points, localTrends));
          if (trendsData.partial) {
            setTrendsWarning(
              trendsData.message ??
                "Some monthly PR and issue counts may be missing due to GitHub search limits.",
            );
          }
        } catch {
          if (cancelled) return;
          setTrendPoints(localTrends);
          setTrendsWarning(
            "Could not load monthly PR and issue trends from GitHub. Repository and star trends are still shown.",
          );
        }
      })
      .catch(err => {
        if (!cancelled) {
          setReposError(err instanceof Error ? err.message : "Failed to load repositories");
          setLoading(false);
        }
      })
      .finally(() => {
        if (!cancelled) setTrendsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: { xs: "calc(100vh - 120px)", md: "calc(100vh - 140px)" },
          minHeight: 400,
        }}
      >
        <Box sx={{ flexShrink: 0, pb: 2 }}>
          <Header
            title="Repositories"
            organization={org}
            subtitle="Browse tektoncd projects, then expand a row for workload charts and tracked issues."
          />
          {reposError && <Alert severity="error">{reposError}</Alert>}
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", flex: 1, alignItems: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <DashboardStats
              repositories={repos}
              organization={org}
              trendPoints={trendPoints}
              trendsLoading={trendsLoading}
              trendsWarning={trendsWarning}
            />
            <RepositoriesTable repositories={repos} />
          </>
        )}
      </Box>
    </DashboardLayout>
  );
}
