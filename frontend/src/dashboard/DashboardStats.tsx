import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import StarIcon from "@mui/icons-material/Star";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import { useMemo, useState, type ReactNode } from "react";
import type { Repository, TrendPoint } from "../api/client";
import { useStatCardsPreferences } from "../theme/StatCardsPreferencesContext";
import { buildYearlyTrendsFromRepos } from "./buildTrendsFromRepos";
import {
  describeLatestMonthTrend,
  describeLatestYearTrend,
  periodLabelsFromPoints,
  sparkSeries,
  type TrendDirection,
  type TrendMetricKey,
} from "./statTrendUtils";
import { StatTrendDetailDialog, type StatTrendDetailProps } from "./StatTrendDetailDialog";
import { useAnimatedCount } from "./useAnimatedCount";

type TrendGranularity = "month" | "year";

function usesYearlyTrend(key: TrendMetricKey): boolean {
  return key === "repos" || key === "stars";
}

type DashboardStatsProps = {
  repositories: Repository[];
  organization: string;
  trendPoints?: TrendPoint[];
  /** Repo list still loading — headline values and yearly charts. */
  reposPending?: boolean;
  trendsPending?: boolean;
  trendsWarning?: string | null;
};

type PaletteKey = "primary" | "secondary" | "warning" | "error";

type StatDef = {
  label: string;
  icon: ReactNode;
  paletteKey: PaletteKey;
  trendKey: TrendMetricKey;
  value: number;
};

function statCardSx(theme: Theme, paletteKey: PaletteKey) {
  const color = theme.palette[paletteKey].main;
  return {
    height: "100%",
    cursor: "pointer",
    userSelect: "none",
    borderColor: alpha(color, theme.palette.mode === "light" ? 0.28 : 0.4),
    background: theme.palette.background.paper,
    transition: "box-shadow 0.2s, border-color 0.2s",
    "&:hover": {
      borderColor: color,
      boxShadow: `0 4px 20px ${alpha(color, 0.18)}`,
    },
  };
}

function AnimatedStatValue({ value }: { value: number }) {
  const animated = useAnimatedCount(value);
  return (
    <Typography variant="h4" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
      {animated.toLocaleString()}
    </Typography>
  );
}

function formatAxisCount(value: number | null): string {
  if (value == null) return "";
  const n = Math.round(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function statTrendItemLabel(trendKey: TrendMetricKey): string {
  switch (trendKey) {
    case "repos":
      return "repos created";
    case "stars":
      return "stars on new repos";
    case "open_prs":
      return "PRs opened";
    case "open_issues":
      return "issues opened";
  }
}

function trendIcon(direction: TrendDirection) {
  switch (direction) {
    case "up":
      return <TrendingUpIcon sx={{ fontSize: 16 }} />;
    case "down":
      return <TrendingDownIcon sx={{ fontSize: 16 }} />;
    case "flat":
      return <TrendingFlatIcon sx={{ fontSize: 16 }} />;
  }
}

function trendChipColor(direction: TrendDirection, theme: Theme): string {
  switch (direction) {
    case "up":
      return theme.palette.success.main;
    case "down":
      return theme.palette.warning.main;
    case "flat":
      return theme.palette.text.secondary;
  }
}

const CHART_HEIGHT = 112;

function StatTrendChart({
  data,
  monthLabels,
  color,
  isPending,
}: {
  data: number[];
  monthLabels: string[];
  color: string;
  isPending: boolean;
}) {
  if (isPending) {
    return <Skeleton variant="rounded" height={CHART_HEIGHT} sx={{ mt: 1.5, borderRadius: 1.5 }} />;
  }

  const hasActivity = data.some(v => v > 0);
  const labels = monthLabels.length === data.length ? monthLabels : data.map((_, i) => `M${i + 1}`);

  if (!hasActivity) {
    return (
      <Box
        sx={{
          mt: 1.5,
          height: CHART_HEIGHT,
          borderRadius: 1.5,
          bgcolor: theme => alpha(theme.palette.text.primary, 0.04),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          No monthly activity
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1.5, width: "100%", height: CHART_HEIGHT }}>
      <LineChart
        height={CHART_HEIGHT}
        margin={{ top: 8, bottom: 32, left: 8, right: 8 }}
        xAxis={[
          {
            scaleType: "point",
            data: labels,
            tickLabelStyle: { fontSize: 10 },
          },
        ]}
        yAxis={[
          {
            width: "auto",
            tickLabelStyle: { fontSize: 10 },
            valueFormatter: formatAxisCount,
          },
        ]}
        series={[
          {
            data,
            color,
            area: true,
            curve: "natural",
            showMark: false,
          },
        ]}
        grid={{ horizontal: true }}
        hideLegend
        sx={{
          width: "100%",
          "& .MuiAreaElement-root": { fillOpacity: 0.2 },
          "& .MuiLineElement-root": { strokeWidth: 2 },
        }}
      />
    </Box>
  );
}

function StatTrendBadge({
  direction,
  label,
  summary,
  isPending,
}: {
  direction: TrendDirection;
  label: string;
  summary: string;
  isPending: boolean;
}) {
  const theme = useTheme();
  if (isPending) {
    return <Skeleton width={72} height={24} sx={{ mt: 0.75 }} />;
  }

  const color = trendChipColor(direction, theme);

  return (
    <Tooltip title={summary} placement="bottom-start" enterTouchDelay={0}>
      <Chip
        size="small"
        icon={trendIcon(direction)}
        label={label}
        sx={{
          height: 24,
          fontSize: "0.75rem",
          fontWeight: 600,
          color,
          borderColor: alpha(color, 0.35),
          bgcolor: alpha(color, theme.palette.mode === "light" ? 0.08 : 0.14),
          "& .MuiChip-icon": { color },
        }}
        variant="outlined"
      />
    </Tooltip>
  );
}

function StatCard({
  icon,
  label,
  value,
  paletteKey,
  trendKey,
  chartPoints,
  granularity,
  valuePending,
  chartPending,
  trendsPending,
  onOpenDetail,
}: StatDef & {
  chartPoints: TrendPoint[];
  granularity: TrendGranularity;
  valuePending: boolean;
  chartPending: boolean;
  trendsPending: boolean;
  onOpenDetail: (color: string) => void;
}) {
  const theme = useTheme();
  const color = theme.palette[paletteKey].main;
  const series = sparkSeries(chartPoints, trendKey);
  const periodLabels = periodLabelsFromPoints(chartPoints, granularity);
  const trendInsight =
    granularity === "year"
      ? describeLatestYearTrend(series, periodLabels, statTrendItemLabel(trendKey))
      : describeLatestMonthTrend(series, periodLabels, statTrendItemLabel(trendKey));

  return (
    <Card
      variant="outlined"
      sx={t => statCardSx(t, paletteKey)}
      onClick={() => onOpenDetail(color)}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(color);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${value.toLocaleString()}. Click for trend details.`}
    >
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Box sx={{ color, display: "flex", opacity: 0.9 }}>{icon}</Box>
        </Stack>

        <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap", minHeight: 40 }}>
          {valuePending ? (
            <CircularProgress size={28} sx={{ color }} />
          ) : (
            <AnimatedStatValue value={value} />
          )}
          {!valuePending && trendInsight ? (
            <StatTrendBadge
              direction={trendInsight.direction}
              label={trendInsight.label}
              summary={trendInsight.summary}
              isPending={trendsPending}
            />
          ) : !valuePending && trendsPending ? (
            <Skeleton width={72} height={24} />
          ) : null}
        </Stack>

        <StatTrendChart
          data={series}
          monthLabels={periodLabels}
          color={color}
          isPending={chartPending}
        />
      </CardContent>
    </Card>
  );
}

function openPullRequests(repo: Repository): number {
  return repo.open_pull_requests_count ?? 0;
}

type DetailState = Omit<StatTrendDetailProps, "open" | "onClose">;

export function DashboardStats({
  repositories,
  organization,
  trendPoints = [],
  reposPending = false,
  trendsPending = false,
  trendsWarning = null,
}: DashboardStatsProps) {
  const { showStats, toggleShowStats } = useStatCardsPreferences();
  const [detail, setDetail] = useState<DetailState | null>(null);
  const yearlyTrendPoints = useMemo(
    () => buildYearlyTrendsFromRepos(repositories),
    [repositories],
  );

  const totalStars = repositories.reduce((sum, r) => sum + r.stargazers_count, 0);
  const totalIssues = repositories.reduce((sum, r) => sum + r.open_issues_count, 0);
  const totalOpenPRs = repositories.reduce((sum, r) => sum + openPullRequests(r), 0);

  const stats: StatDef[] = [
    {
      label: `${organization} repos`,
      icon: <FolderOutlinedIcon fontSize="small" />,
      paletteKey: "primary",
      trendKey: "repos",
      value: repositories.length,
    },
    {
      label: "Total stars",
      icon: <StarIcon fontSize="small" />,
      paletteKey: "warning",
      trendKey: "stars",
      value: totalStars,
    },
    {
      label: "Open PRs",
      icon: <CallMergeOutlinedIcon fontSize="small" />,
      paletteKey: "secondary",
      trendKey: "open_prs",
      value: totalOpenPRs,
    },
    {
      label: "Open issues",
      icon: <BugReportOutlinedIcon fontSize="small" />,
      paletteKey: "error",
      trendKey: "open_issues",
      value: totalIssues,
    },
  ];

  return (
    <Box sx={{ mb: showStats ? 2 : 1, cursor: "default" }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: showStats ? 1.25 : 0 }}>
        <Tooltip title={showStats ? "Hide overview stats" : "Show overview stats"}>
          <IconButton
            size="small"
            aria-label={showStats ? "Hide overview stats" : "Show overview stats"}
            aria-pressed={showStats}
            onClick={toggleShowStats}
            sx={theme => ({
              border: 1,
              borderColor: showStats ? "primary.main" : "divider",
              background: showStats
                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.secondary.main, 0.12)})`
                : "transparent",
              "&:hover": {
                borderColor: "primary.main",
                boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
              },
            })}
          >
            <AutoAwesomeOutlinedIcon fontSize="small" color={showStats ? "primary" : "action"} />
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={showStats} timeout={300} unmountOnExit>
        {trendsWarning && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            {trendsWarning}
          </Alert>
        )}
        <Grid container spacing={2}>
          {stats.map(stat => {
            const yearly = usesYearlyTrend(stat.trendKey);
            const chartPoints = yearly ? yearlyTrendPoints : trendPoints;
            return (
              <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  {...stat}
                  chartPoints={chartPoints}
                  granularity={yearly ? "year" : "month"}
                  valuePending={reposPending}
                  chartPending={yearly ? reposPending : trendsPending}
                  trendsPending={yearly ? reposPending : trendsPending}
                  onOpenDetail={color =>
                    setDetail({
                      label: stat.label,
                      icon: stat.icon,
                      value: stat.value,
                      color,
                      trendKey: stat.trendKey,
                      granularity: yearly ? "year" : "month",
                      chartPoints,
                      trendsPending: yearly ? reposPending : trendsPending,
                      organization,
                    })
                  }
                />
              </Grid>
            );
          })}
        </Grid>
      </Collapse>

      {detail && (
        <StatTrendDetailDialog
          open
          onClose={() => setDetail(null)}
          label={detail.label}
          icon={detail.icon}
          value={detail.value}
          color={detail.color}
          trendKey={detail.trendKey}
          granularity={detail.granularity}
          chartPoints={detail.chartPoints}
          trendsPending={detail.trendsPending}
          organization={detail.organization}
        />
      )}
    </Box>
  );
}
