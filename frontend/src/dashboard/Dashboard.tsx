import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { useAiMode } from "../theme/AiModeContext";
import {
  useRefetchTrackingTrendsAfterRepos,
  useRepositoriesQuery,
  useTrackingTrendsQuery,
} from "../query/dashboardQueries";
import { buildTrendsFromRepos, mergeTrendPoints } from "./buildTrendsFromRepos";
import { DashboardLayout } from "./DashboardLayout";
import { DashboardStats } from "./DashboardStats";
import { Header } from "./Header";
import { RepositoriesTable } from "./RepositoriesTable";

export function Dashboard() {
  const { aiMode } = useAiMode();

  const reposQuery = useRepositoriesQuery(aiMode);
  const trendsQuery = useTrackingTrendsQuery(aiMode);

  const repositories = reposQuery.data?.repositories ?? [];
  const org = reposQuery.data?.organization ?? "tektoncd";
  const reposPending = reposQuery.isPending && repositories.length === 0;
  const reposReady = reposQuery.isSuccess && repositories.length > 0;

  useRefetchTrackingTrendsAfterRepos(aiMode, reposReady);

  const localTrendPoints = buildTrendsFromRepos(repositories);
  const trendPoints = trendsQuery.data
    ? mergeTrendPoints(trendsQuery.data.points, localTrendPoints)
    : localTrendPoints;

  let trendsWarning: string | null = null;
  if (trendsQuery.isError) {
    trendsWarning =
      "Could not load monthly PR and issue trends from GitHub. Repository and star trends are still shown.";
  } else if (trendsQuery.data?.partial && !trendsQuery.isFetching) {
    trendsWarning =
      trendsQuery.data.message ??
      "Some monthly PR and issue counts may be missing due to GitHub search limits.";
  }

  const reposError =
    reposQuery.isError && repositories.length === 0
      ? reposQuery.error instanceof Error
        ? reposQuery.error.message
        : "Failed to load repositories"
      : null;

  return (
    <DashboardLayout>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
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

        <DashboardStats
          repositories={repositories}
          organization={org}
          trendPoints={trendPoints}
          reposPending={reposPending}
          trendsPending={trendsQuery.isPending && !trendsQuery.isError}
          trendsWarning={trendsWarning}
        />

        <RepositoriesTable repositories={repositories} loading={reposPending} />
      </Box>
    </DashboardLayout>
  );
}
