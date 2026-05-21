import CachedIcon from "@mui/icons-material/Cached";
import CloseIcon from "@mui/icons-material/Close";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Fade from "@mui/material/Fade";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CategoryInsight, Issue, PullRequestItem, Repository } from "../api/client";
import { useAiMode } from "../theme/AiModeContext";
import { useDelayedPending } from "../hooks/useDelayedPending";
import { useRepoInsightsQuery } from "../query/insightsQuery";
import { InsightsLoading } from "./InsightsLoading";
import { describeLatestMonthTrend } from "./statTrendUtils";
import { TrendInsightBanner } from "./TrendInsightBanner";

const CHART_COLORS = [
  "#1976d2",
  "#d32f2f",
  "#ed6c02",
  "#2e7d32",
  "#9c27b0",
  "#00838f",
  "#6d4c41",
];
const LOADING_DELAY_MS = 150;
const STALE_DAYS = 30;

/** Backend sends months as `YYYY-MM` (UTC). */
function formatMonthLabel(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return yearMonth;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatReleaseDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function createdYearMonth(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function trendItemLabel(categoryKey: string): string {
  if (categoryKey === "pending_prs" || categoryKey === "stale_prs") return "pull requests opened";
  if (categoryKey === "dependency_alerts") return "alerts";
  if (categoryKey === "stale_issues") return "stale issues opened";
  return "issues opened";
}

function monthRangeLabel(months: string[]): string | null {
  if (months.length === 0) return null;
  const first = formatMonthLabel(months[0]!);
  const last = formatMonthLabel(months[months.length - 1]!);
  return first === last ? first : `${first} – ${last}`;
}

function isPrCategory(key: string): boolean {
  return key === "pending_prs" || key === "stale_prs";
}

function filterCategoryByMonth(category: CategoryInsight, month: string | null): CategoryInsight {
  if (!month) return category;

  if (category.pull_requests?.length) {
    const pull_requests = category.pull_requests.filter(
      pr => createdYearMonth(pr.created_at) === month,
    );
    return { ...category, pull_requests, total: pull_requests.length };
  }

  if (category.issues?.length) {
    const issues = category.issues.filter(issue => createdYearMonth(issue.created_at) === month);
    return { ...category, issues, total: issues.length };
  }

  return category;
}

type RepositoryInsightPanelProps = {
  repo: Repository;
  /** Increment to force refresh from GitHub (bypass server cache). */
  refreshTrigger: number;
  onClose: () => void;
};

function PanelToolbar({
  onClose,
  children,
}: {
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        {children}
      </Stack>
      <Tooltip title="Collapse">
        <IconButton size="small" aria-label="Collapse insights" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

type ComplexityLevel = "beginner" | "intermediate" | "advanced";
const ALL_COMPLEXITY_LEVELS: ComplexityLevel[] = ["beginner", "intermediate", "advanced"];

export function RepositoryInsightPanel({ repo, refreshTrigger, onClose }: RepositoryInsightPanelProps) {
  const { aiMode } = useAiMode();
  const parts = repo.full_name.split("/");
  const owner = parts[0] ?? "";
  const name = parts[1] ?? "";

  const insightsQuery = useRepoInsightsQuery(
    owner,
    name,
    refreshTrigger > 0,
    aiMode,
    Boolean(owner && name),
  );

  const [selectedKey, setSelectedKey] = useState("good_first_issues");
  const [monthFilter, setMonthFilter] = useState<string | null>(null);

  const isPending = insightsQuery.isPending && !insightsQuery.data;
  const loaderDelay = refreshTrigger > 0 ? 0 : LOADING_DELAY_MS;
  const showLoader = useDelayedPending(isPending, loaderDelay);
  const [complexityFilter, setComplexityFilter] = useState<ComplexityLevel | null>(null);

  const safeCategories = insightsQuery.data?.categories ?? [];
  const latestRelease = insightsQuery.data?.latestRelease ?? null;
  const fromCache = insightsQuery.data?.fromCache ?? false;
  const error =
    insightsQuery.isError && !insightsQuery.data
      ? insightsQuery.error instanceof Error
        ? insightsQuery.error.message
        : "Failed to load insights"
      : null;

  useEffect(() => {
    if (insightsQuery.data?.selectedKey) {
      setSelectedKey(insightsQuery.data.selectedKey);
      setMonthFilter(null);
    }
  }, [insightsQuery.data?.selectedKey]);

  const defaultCategoryKey = (list: CategoryInsight[]) =>
    list.find(c => c.total > 0)?.key ?? list[0]?.key ?? "good_first_issues";

  const selected = useMemo(
    () => safeCategories.find(c => c.key === selectedKey) ?? safeCategories[0],
    [safeCategories, selectedKey],
  );

  const filteredSelected = useMemo(
    () => (selected ? filterCategoryByMonth(selected, monthFilter) : undefined),
    [selected, monthFilter],
  );

  const hasIssueCategory = selected?.issues && selected.issues.length > 0;

  const filteredIssues = useMemo(() => {
    if (!filteredSelected?.issues) return [];
    if (!complexityFilter) return filteredSelected.issues;
    return filteredSelected.issues.filter(i => i.complexity === complexityFilter);
  }, [filteredSelected, complexityFilter]);

  const pieData = useMemo(
    () =>
      safeCategories.map((c, i) => ({
        id: c.key,
        label: (location: string) => location === "tooltip" ? c.label : `${c.label} (${c.total})`,
        value: c.total,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [safeCategories],
  );

  const hasInsightData = useMemo(
    () => pieData.some(d => d.value > 0) || Boolean(latestRelease?.url),
    [pieData, latestRelease],
  );

  const defaultKey = defaultCategoryKey(safeCategories);
  const hasActiveFilters = monthFilter !== null || selectedKey !== defaultKey;

  const resetAllFilters = () => {
    setMonthFilter(null);
    setSelectedKey(defaultKey);
  };

  const selectCategory = (key: string) => {
    setSelectedKey(key);
    setMonthFilter(null);
  };

  const panelShellSx = {
    p: 2,
    bgcolor: "action.hover",
    borderTop: 1,
    borderColor: "divider",
  } as const;

  if (isPending && safeCategories.length === 0) {
    return (
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
        </PanelToolbar>
        {showLoader ? <InsightsLoading /> : <Box sx={{ minHeight: 16 }} />}
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
        </PanelToolbar>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (safeCategories.length === 0 || !selected || !filteredSelected) {
    return (
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
        </PanelToolbar>
        <Typography variant="body2" color="text.secondary">
          No upstream tracking data is available for this repository.
        </Typography>
      </Box>
    );
  }

  if (!hasInsightData) {
    return (
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
          {fromCache && refreshTrigger === 0 && (
            <Tooltip title="Loaded from server cache (up to 15 min old). Use Refresh for latest data.">
              <Chip icon={<CachedIcon />} label="Cached" size="small" variant="outlined" />
            </Tooltip>
          )}
        </PanelToolbar>
        <Typography variant="body2" color="text.secondary">
          Nothing to show yet — no open good-first issues, bugs, pull requests, stale items, or
          dependency alerts were found for this repository.
        </Typography>
      </Box>
    );
  }

  const months = selected.monthly.map(m => m.month);
  const monthLabels = months.map(formatMonthLabel);
  const monthRange = monthRangeLabel(months);
  const counts = selected.monthly.map(m => m.count);
  const monthTrend = describeLatestMonthTrend(counts, monthLabels, trendItemLabel(selectedKey));
  const selectedBarColor =
    pieData.find(d => d.id === selectedKey)?.color ?? CHART_COLORS[0] ?? "#1976d2";

  const listCount = filteredSelected.total;
  const listTitle = monthFilter
    ? `${selected.label} in ${formatMonthLabel(monthFilter)} (${listCount})`
    : `${selected.label} (${listCount})`;

  return (
    <Fade in timeout={400}>
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
          {fromCache && refreshTrigger === 0 && (
            <Tooltip title="Loaded from server cache (up to 15 min old). Use Refresh for latest data.">
              <Chip icon={<CachedIcon />} label="Cached" size="small" variant="outlined" />
            </Tooltip>
          )}
          {latestRelease?.url && (
            <Chip
              component="a"
              href={latestRelease.url}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              size="small"
              variant="outlined"
              label={
                latestRelease.published_at
                  ? `Release ${latestRelease.tag} · ${formatReleaseDate(latestRelease.published_at)}`
                  : `Release ${latestRelease.tag}`
              }
              onClick={e => e.stopPropagation()}
            />
          )}
          <Tooltip title={hasActiveFilters ? "Clear category and month filters" : "No filters to reset"}>
            <span>
              <Chip
                icon={<FilterAltOffIcon />}
                label="Reset filters"
                size="small"
                variant="outlined"
                disabled={!hasActiveFilters}
                clickable={hasActiveFilters}
                onClick={
                  hasActiveFilters
                    ? e => {
                        e.stopPropagation();
                        resetAllFilters();
                      }
                    : undefined
                }
              />
            </span>
          </Tooltip>
        </PanelToolbar>

        <Stack spacing={1.5} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Chip
              size="small"
              color="primary"
              variant={selectedKey === defaultKey && !monthFilter ? "filled" : "outlined"}
              label={selected.label}
              onDelete={
                selectedKey !== defaultKey
                  ? () => {
                      setSelectedKey(defaultKey);
                      setMonthFilter(null);
                    }
                  : undefined
              }
            />
            {monthFilter && (
              <Chip
                size="small"
                variant="outlined"
                label={`Month: ${formatMonthLabel(monthFilter)}`}
                onDelete={() => setMonthFilter(null)}
              />
            )}
          </Stack>
          {monthTrend && <TrendInsightBanner insight={monthTrend} color={selectedBarColor} />}
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Workload mix — click a segment
              </Typography>
              <PieChart
              series={[
                {
                  data: pieData.filter(d => d.value > 0),
                  innerRadius: 50,
                  outerRadius: 90,
                  paddingAngle: 2,
                  cornerRadius: 3,
                  highlightScope: { fade: "global", highlight: "item" },
                  faded: { additionalRadius: -8 },
                },
              ]}
              height={220}
              onItemClick={(_e, item) => {
                const slice = pieData.filter(d => d.value > 0);
                const entry = item?.dataIndex != null ? slice[item.dataIndex] : undefined;
                if (entry) {
                  selectCategory(String(entry.id));
                  setComplexityFilter(null);
                }
              }}
            />
              {(selectedKey === "stale_prs" || selectedKey === "stale_issues") && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Stale = no GitHub activity for {STALE_DAYS}+ days
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="subtitle2" gutterBottom>
                {selected.label} opened by month
              </Typography>
              {monthRange && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  {monthRange} · by creation date · click a bar to filter the list below
                </Typography>
              )}
              {months.length > 0 ? (
                <>
                  <BarChart
                    xAxis={[{ scaleType: "band", data: monthLabels }]}
                    series={[
                      {
                        data: counts,
                        label: selected.label,
                        color: selectedBarColor,
                        barLabel: "value",
                        barLabelPlacement: "outside",
                      },
                    ]}
                    height={220}
                    margin={{ left: 32, right: 12, top: 16, bottom: 48 }}
                    yAxis={[{ width: 36, tickLabelStyle: { fontSize: 11 } }]}
                    onItemClick={(_e, item) => {
                      if (item?.dataIndex != null && months[item.dataIndex]) {
                        setMonthFilter(months[item.dataIndex]!);
                      }
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    Each bar is how many were opened that month. Click a bar to filter the list, or use
                    Reset filters to show all months.
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No dated items for this category.
                </Typography>
              )}
            </Grid>
          </Grid>
        </Paper>

        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
              <Typography variant="subtitle2">
                {selected.label} ({complexityFilter ? filteredIssues.length : filteredSelected.total})
              </Typography>
              {aiMode && hasIssueCategory && (
                <>
                  <Chip
                    label="All"
                    size="small"
                    variant={complexityFilter === null ? "filled" : "outlined"}
                    onClick={() => setComplexityFilter(null)}
                    sx={{ fontWeight: complexityFilter === null ? 700 : 400 }}
                  />
                  {ALL_COMPLEXITY_LEVELS.map(level => {
                    const cfg = COMPLEXITY_CONFIG[level]!;
                    const active = complexityFilter === level;
                    return (
                      <Chip
                        key={level}
                        label={cfg.label}
                        size="small"
                        color={cfg.color}
                        variant={active ? "filled" : "outlined"}
                        onClick={() => setComplexityFilter(active ? null : level)}
                        sx={{ fontWeight: active ? 700 : 400 }}
                      />
                    );
                  })}
                </>
              )}
            </Stack>
          <CategoryItemList category={filteredSelected} filteredIssues={complexityFilter ? filteredIssues : undefined}/>
        </Box>
      </Box>
    </Fade>
  );
}

const COMPLEXITY_CONFIG: Record<string, { label: string; color: "success" | "warning" | "error"; tooltip: string }> = {
  beginner: { label: "Beginner", color: "success", tooltip: "Good for newcomers — simple changes like docs, config, or small fixes" },
  intermediate: { label: "Intermediate", color: "warning", tooltip: "Moderate difficulty — requires codebase familiarity and some debugging" },
  advanced: { label: "Advanced", color: "error", tooltip: "Complex — involves architecture, performance, or deep domain knowledge" },
};

function ComplexityChip({ complexity }: { complexity?: string }) {
  if (!complexity) return null;
  const config = COMPLEXITY_CONFIG[complexity];
  if (!config) return null;
  return (
    <Tooltip title={config.tooltip}>
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
        sx={{
          flexShrink: 0,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          fontWeight: 600,
          fontSize: "0.75rem",
          "& .MuiChip-label": {
            px: 0.75,
            py: 0,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
          },
        }}
      />
    </Tooltip>
  );
}

function formatItemDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function itemDateSubtitle(createdAt?: string, updatedAt?: string, stale = false): string | undefined {
  const updated = formatItemDate(updatedAt);
  const created = formatItemDate(createdAt);
  if (stale && updated) return `Last updated ${updated}`;
  if (created) return `Opened ${created}`;
  if (updated) return `Updated ${updated}`;
  return undefined;
}


function InsightList({ children }: { children: ReactNode }) {
  return (
    <Stack spacing={1} sx={{ maxHeight: 280, overflow: "auto", pr: 0.25, pt: 0.5 }}>
      {children}
    </Stack>
  );
}

function InsightEmptyState({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: 1.5, bgcolor: "background.paper" }}>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Paper>
  );
}

function InsightItemRow({
  number,
  title,
  href,
  subtitle,
  complexity,
}: {
  number: number;
  title: string;
  href: string;
  subtitle?: string;
  complexity?: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={theme => ({
        px: 1.5,
        py: 1.25,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        borderRadius: 1.5,
        bgcolor: "background.paper",
        transition: theme.transitions.create(["border-color", "box-shadow", "background-color"], {
          duration: theme.transitions.duration.shortest,
        }),
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: "action.hover",
          boxShadow: 1,
        },
      })}
    >
      <Chip
        label={`#${number}`}
        size="small"
        color="primary"
        variant="outlined"
        sx={{
          fontWeight: 700,
          flexShrink: 0,
          height: 26,
          display: "inline-flex",
          alignItems: "center",
          "& .MuiChip-label": { px: 1, py: 0, lineHeight: 1, display: "flex", alignItems: "center" },
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          color="text.primary"
          sx={{
            fontWeight: 500,
            fontSize: "0.875rem",
            lineHeight: 1.45,
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </Link>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
        {complexity && <ComplexityChip complexity={complexity} />}
        <Tooltip title="Open on GitHub">
          <IconButton
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            aria-label="Open on GitHub"
            sx={{
              border: 1,
              borderColor: "divider",
              "&:hover": { borderColor: "primary.main", bgcolor: "action.selected" },
            }}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

function CategoryItemList({ category, filteredIssues }: { category: CategoryInsight; filteredIssues?: Issue[] }) {
  const stale = category.key === "stale_prs" || category.key === "stale_issues";

  if (isPrCategory(category.key)) {
    if (!category.pull_requests?.length) {
      return <InsightEmptyState>No items match the current filters.</InsightEmptyState>;
    }
    return (
      <InsightList>
        {category.pull_requests.map((pr: PullRequestItem) => (
          <InsightItemRow
            key={pr.id}
            number={pr.number}
            title={pr.title}
            href={pr.html_url}
            subtitle={itemDateSubtitle(pr.created_at, pr.updated_at, stale)}
          />
        ))}
      </InsightList>
    );
  }

  if (category.key === "dependency_alerts") {
    return (
      <InsightEmptyState>
        {category.total} open Dependabot alert(s). Enable GITHUB_TOKEN for alert details.
      </InsightEmptyState>
    );
  }
  const issues = filteredIssues ?? category.issues;
  if (!issues?.length) {
    return <InsightEmptyState>No items match the current filters.</InsightEmptyState>;
  }

  return (
    <InsightList>
      {issues.map((issue: Issue) => (
        <InsightItemRow
          key={issue.id}
          number={issue.number}
          title={issue.title}
          href={issue.html_url}
          subtitle={itemDateSubtitle(issue.created_at, issue.updated_at, stale)}
          complexity={issue.complexity}
        />
      ))}
    </InsightList>
  );
}
