import ClearIcon from "@mui/icons-material/Clear";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, type Theme } from "@mui/material/styles";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { Repository } from "../api/client";
import { RepositoryCardSkeleton } from "./DashboardLoading";
import { RepositoryInsightPanel } from "./RepositoryInsightPanel";

type RepositoriesTableProps = {
  repositories: Repository[];
  /** Initial repo list fetch — show card skeletons in the list area. */
  loading?: boolean;
};

type RepoSortKey = "name-asc" | "stars-desc" | "stars-asc" | "release-desc" | "release-asc" | "issues-desc";

/** body2 + Roboto — same scale as repo card titles and descriptions */
function repoToolbarControlSx(theme: Theme) {
  const body = theme.typography.body2;
  return {
    "& .MuiOutlinedInput-root": {
      fontSize: body.fontSize,
      lineHeight: body.lineHeight,
      letterSpacing: body.letterSpacing,
      fontFamily: theme.typography.fontFamily,
      borderRadius: 1,
    },
    "& .MuiInputBase-input, & .MuiSelect-select": {
      fontSize: body.fontSize,
      lineHeight: body.lineHeight,
      letterSpacing: body.letterSpacing,
      fontWeight: 400,
      fontFamily: theme.typography.fontFamily,
    },
    "& .MuiInputBase-input::placeholder": {
      fontSize: body.fontSize,
      lineHeight: body.lineHeight,
      letterSpacing: body.letterSpacing,
      fontWeight: 400,
      opacity: 1,
      color: theme.palette.text.secondary,
    },
  };
}

function repoToolbarMenuItemSx(theme: Theme) {
  const body = theme.typography.body2;
  return {
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
    letterSpacing: body.letterSpacing,
    fontWeight: 400,
    fontFamily: theme.typography.fontFamily,
  };
}

const SORT_OPTIONS: { value: RepoSortKey; label: string }[] = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "stars-desc", label: "Stars (high → low)" },
  { value: "stars-asc", label: "Stars (low → high)" },
  { value: "release-desc", label: "Release (newest)" },
  { value: "release-asc", label: "Release (oldest)" },
  { value: "issues-desc", label: "Open issues (most)" },
];

function releaseTimestamp(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function repoMatchesQuery(repo: Repository, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [repo.name, repo.full_name, repo.description ?? "", repo.language ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function compareRepos(a: Repository, b: Repository, sort: RepoSortKey): number {
  switch (sort) {
    case "name-asc":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    case "stars-desc":
      return b.stargazers_count - a.stargazers_count || a.name.localeCompare(b.name);
    case "stars-asc":
      return a.stargazers_count - b.stargazers_count || a.name.localeCompare(b.name);
    case "release-desc": {
      const diff = releaseTimestamp(b.last_release_at) - releaseTimestamp(a.last_release_at);
      if (diff !== 0) return diff;
      const aHas = a.last_release_at ? 1 : 0;
      const bHas = b.last_release_at ? 1 : 0;
      return bHas - aHas || a.name.localeCompare(b.name);
    }
    case "release-asc": {
      const aTs = releaseTimestamp(a.last_release_at);
      const bTs = releaseTimestamp(b.last_release_at);
      if (aTs === 0 && bTs === 0) return a.name.localeCompare(b.name);
      if (aTs === 0) return 1;
      if (bTs === 0) return -1;
      return aTs - bTs || a.name.localeCompare(b.name);
    }
    case "issues-desc":
      return b.open_issues_count - a.open_issues_count || a.name.localeCompare(b.name);
    default:
      return 0;
  }
}

/** App bar clearance when scrolling an expanded card into view. */
const SCROLL_TOP_OFFSET = 136;

function scrollCardIntoContainer(container: HTMLElement, card: HTMLElement, offset: number) {
  const containerTop = container.getBoundingClientRect().top;
  const cardTop = card.getBoundingClientRect().top;
  const next = container.scrollTop + (cardTop - containerTop) - offset;
  container.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
}

/** Per-mode accents tuned for readable chips on light/dark surfaces. */
const LANGUAGE_PALETTES: Record<string, { light: string; dark: string }> = {
  Go: { light: "#00758D", dark: "#5BC0DE" },
  TypeScript: { light: "#235A97", dark: "#79B8FF" },
  Python: { light: "#2D6A9F", dark: "#79B8FF" },
  Shell: { light: "#3D7C3A", dark: "#8FD14F" },
  JavaScript: { light: "#9A6700", dark: "#FFD666" },
  YAML: { light: "#A31621", dark: "#FF8A80" },
  Rust: { light: "#A0410D", dark: "#FF9F69" },
  Java: { light: "#B07200", dark: "#FFC266" },
  Markdown: { light: "#455A64", dark: "#B0BEC5" },
  HCL: { light: "#5C4D9E", dark: "#CE93D8" },
  Makefile: { light: "#5D4037", dark: "#BCAAA4" },
};

function languageAccent(theme: Theme, language?: string): string {
  if (!language) return theme.palette.primary.main;
  const palette = LANGUAGE_PALETTES[language];
  if (!palette) {
    return theme.palette.mode === "light" ? theme.palette.text.secondary : theme.palette.text.primary;
  }
  return theme.palette.mode === "light" ? palette.light : palette.dark;
}

function languageChipSx(theme: Theme, language: string) {
  const accent = languageAccent(theme, language);
  const isLight = theme.palette.mode === "light";
  return {
    fontWeight: 600,
    color: accent,
    borderColor: alpha(accent, isLight ? 0.55 : 0.7),
    bgcolor: alpha(accent, isLight ? 0.1 : 0.2),
  };
}

function languageAvatarSx(theme: Theme, language?: string) {
  const accent = languageAccent(theme, language);
  const isLight = theme.palette.mode === "light";
  return {
    fontWeight: 700,
    color: accent,
    bgcolor: alpha(accent, isLight ? 0.14 : 0.24),
  };
}

function formatReleaseDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function MetricBadge({
  icon,
  label,
  value,
  iconColor,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  iconColor: string;
}) {
  return (
    <Tooltip title={label}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: "action.hover",
        }}
      >
        <Box component="span" sx={{ display: "flex", color: iconColor, opacity: 0.95 }}>
          {icon}
        </Box>
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {value.toLocaleString()}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export function RepositoriesTable({ repositories, loading = false }: RepositoriesTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshByRepo, setRefreshByRepo] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<RepoSortKey>("stars-desc");
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const visibleRepos = useMemo(() => {
    const filtered = repositories.filter(r => repoMatchesQuery(r, searchQuery));
    return [...filtered].sort((a, b) => compareRepos(a, b, sortKey));
  }, [repositories, searchQuery, sortKey]);

  const setCardRef = (id: number) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  const scrollExpandedCardIntoView = useCallback((id: number) => {
    const container = listRef.current;
    const card = cardRefs.current.get(id);
    if (!container || !card) return;
    requestAnimationFrame(() => {
      scrollCardIntoContainer(container, card, SCROLL_TOP_OFFSET);
    });
  }, []);

  const toggle = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const collapse = () => setExpandedId(null);

  const handleRefresh = (repo: Repository, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(repo.id);
    setRefreshByRepo(prev => ({
      ...prev,
      [repo.id]: (prev[repo.id] ?? 0) + 1,
    }));
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: theme =>
          theme.palette.mode === "light" ? "0 2px 12px rgba(0,0,0,0.06)" : "0 2px 12px rgba(0,0,0,0.35)",
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          px: 2,
          pt: 2,
          pb: 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xs: "stretch", sm: "center" } }}
        >
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search repositories…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            sx={theme => ({
              flex: 1,
              minWidth: { sm: 220 },
              ...repoToolbarControlSx(theme),
            })}
            slotProps={{
              input: {
                sx: theme => theme.typography.body2,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery.trim() ? (
                  <InputAdornment position="end">
                    <Tooltip title="Clear search">
                      <IconButton
                        size="small"
                        aria-label="Clear search"
                        edge="end"
                        onClick={() => setSearchQuery("")}
                      >
                        <ClearIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
          <Select
            size="small"
            variant="outlined"
            value={sortKey}
            aria-label="Sort repositories"
            onChange={e => setSortKey(e.target.value as RepoSortKey)}
            sx={theme => ({
              minWidth: { xs: "100%", sm: 240 },
              ...repoToolbarControlSx(theme),
            })}
            MenuProps={{
              slotProps: {
                list: { dense: true },
                paper: {
                  sx: (theme: Theme) => ({
                    "& .MuiMenuItem-root": repoToolbarMenuItemSx(theme),
                  }),
                },
              },
            }}
            renderValue={value => (
              <Box component="span" sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: 600, flexShrink: 0 }}
                >
                  Sort
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {SORT_OPTIONS.find(o => o.value === value)?.label}
                </Typography>
              </Box>
            )}
          >
            {SORT_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value} sx={theme => repoToolbarMenuItemSx(theme)}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ display: "block", mt: 1, fontWeight: 400 }}>
          {visibleRepos.length === repositories.length
            ? `${repositories.length} repositories`
            : `${visibleRepos.length} of ${repositories.length} repositories`}
          {searchQuery.trim() ? ` matching “${searchQuery.trim()}”` : ""}
          {" · "}
          {SORT_OPTIONS.find(o => o.value === sortKey)?.label}
        </Typography>
      </Box>

      <Box ref={listRef} sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {loading && repositories.length === 0 ? (
          <Stack spacing={1.5}>
            {Array.from({ length: 5 }, (_, i) => (
              <RepositoryCardSkeleton key={i} />
            ))}
          </Stack>
        ) : visibleRepos.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No repositories match your search.
            </Typography>
            {searchQuery.trim() && (
              <Chip
                size="small"
                label="Clear search"
                onClick={() => setSearchQuery("")}
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        ) : (
        <Stack spacing={1.5}>
          {visibleRepos.map(repo => {
            const open = expandedId === repo.id;
            const refreshTrigger = refreshByRepo[repo.id] ?? 0;

            return (
              <Paper
                key={repo.id}
                ref={setCardRef(repo.id)}
                variant="outlined"
                sx={theme => ({
                  borderRadius: 2,
                  overflow: "hidden",
                  scrollMarginTop: `${SCROLL_TOP_OFFSET}px`,
                  borderColor: open ? "primary.main" : "divider",
                  boxShadow: open
                    ? theme.palette.mode === "light"
                      ? "0 2px 8px rgba(25, 118, 210, 0.12)"
                      : "0 2px 8px rgba(144, 202, 249, 0.15)"
                    : "none",
                  transition: theme.transitions.create(["border-color", "box-shadow"], {
                    duration: theme.transitions.duration.short,
                  }),
                })}
              >
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(repo.id)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(repo.id);
                    }
                  }}
                  sx={{
                    p: 2,
                    cursor: "pointer",
                    bgcolor: theme =>
                      open
                        ? theme.palette.mode === "light"
                          ? "rgba(25, 118, 210, 0.06)"
                          : "rgba(144, 202, 249, 0.08)"
                        : "background.paper",
                    "&:hover": {
                      bgcolor: theme =>
                        open
                          ? theme.palette.mode === "light"
                            ? "rgba(25, 118, 210, 0.1)"
                            : "rgba(144, 202, 249, 0.12)"
                          : "action.hover",
                    },
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                    <Tooltip title={open ? "Collapse insights" : "Expand insights"}>
                      <IconButton
                        size="small"
                        aria-label={open ? "Collapse insights" : "Expand insights"}
                        aria-expanded={open}
                        onClick={e => {
                          e.stopPropagation();
                          toggle(repo.id);
                        }}
                        sx={{ mt: 0.25 }}
                      >
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </Tooltip>

                    <Avatar
                      sx={theme => ({
                        width: 40,
                        height: 40,
                        fontSize: 15,
                        flexShrink: 0,
                        ...languageAvatarSx(theme, repo.language),
                      })}
                    >
                      {repo.name.charAt(0).toUpperCase()}
                    </Avatar>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={{ xs: 1, sm: 2 }}
                        sx={{
                          alignItems: { xs: "flex-start", sm: "center" },
                          justifyContent: "space-between",
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {repo.name}
                            </Typography>
                            <Tooltip title="Open on GitHub">
                              <IconButton
                                component="a"
                                href={repo.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                aria-label={`Open ${repo.name} on GitHub`}
                                onClick={e => e.stopPropagation()}
                                sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                              >
                                <OpenInNewIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                            {repo.language && (
                              <Chip
                                label={repo.language}
                                size="small"
                                variant="outlined"
                                sx={theme => languageChipSx(theme, repo.language!)}
                              />
                            )}
                          </Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}
                          >
                            <GitHubIcon sx={{ fontSize: 12 }} />
                            {repo.full_name}
                          </Typography>
                        </Box>

                        <Stack
                          direction="row"
                          spacing={0.75}
                          useFlexGap
                          sx={{ flexShrink: 0, flexWrap: "wrap" }}
                          onClick={e => e.stopPropagation()}
                        >
                          <MetricBadge
                            icon={<StarIcon sx={{ fontSize: 18 }} />}
                            label="Stars"
                            value={repo.stargazers_count}
                            iconColor="#f5a524"
                          />
                          <MetricBadge
                            icon={<CallMergeOutlinedIcon sx={{ fontSize: 17 }} />}
                            label="Open pull requests"
                            value={repo.open_pull_requests_count ?? 0}
                            iconColor="#9c27b0"
                          />
                          <MetricBadge
                            icon={<BugReportOutlinedIcon sx={{ fontSize: 17 }} />}
                            label="Open issues"
                            value={repo.open_issues_count}
                            iconColor="warning.main"
                          />
                          {repo.last_release_url && repo.last_release_tag ? (
                            <Box
                              sx={{
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                bgcolor: "action.hover",
                                maxWidth: 160,
                              }}
                            >
                              <Link
                                href={repo.last_release_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="body2"
                                sx={{ fontWeight: 600, display: "block" }}
                                onClick={e => e.stopPropagation()}
                              >
                                {repo.last_release_tag}
                              </Link>
                              {repo.last_release_at && (
                                <Typography variant="caption" color="text.secondary">
                                  {formatReleaseDate(repo.last_release_at)}
                                </Typography>
                              )}
                            </Box>
                          ) : null}
                          <Tooltip title="Refresh insights from GitHub (bypasses cache)">
                            <IconButton
                              size="small"
                              aria-label="Refresh repository insights"
                              onClick={e => handleRefresh(repo, e)}
                            >
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>

                      <Typography
                        variant="body2"
                        sx={{
                          mt: 1.25,
                          color: repo.description ? "text.primary" : "text.disabled",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {repo.description || "No description"}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Collapse
                  in={open}
                  timeout="auto"
                  unmountOnExit
                  onEntered={() => scrollExpandedCardIntoView(repo.id)}
                >
                  {open && (
                    <RepositoryInsightPanel
                      repo={repo}
                      refreshTrigger={refreshTrigger}
                      onClose={collapse}
                    />
                  )}
                </Collapse>
              </Paper>
            );
          })}
        </Stack>
        )}
      </Box>
    </Paper>
  );
}
