import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import type { ReactNode } from "react";
import type { TrendPoint } from "../api/client";
import {
  describeLatestMonthTrend,
  describeLatestYearTrend,
  periodLabelsFromPoints,
  sparkSeries,
  type TrendGranularity,
  type TrendMetricKey,
} from "./statTrendUtils";
import { TrendInsightBanner } from "./TrendInsightBanner";

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

function statDescription(trendKey: TrendMetricKey, granularity: TrendGranularity, organization: string): string {
  const period = granularity === "year" ? "calendar year" : "month";
  switch (trendKey) {
    case "repos":
      return `Repositories created in the ${organization} organization each ${period}. The headline total is how many repos exist today.`;
    case "stars":
      return `Combined star count on repositories created each ${period}. The headline total is stars across all repos right now.`;
    case "open_prs":
      return `Pull requests opened in the org each ${period} (GitHub search). The headline total is open PRs across repos today.`;
    case "open_issues":
      return `Issues opened in the org each ${period} (GitHub search). The headline total is open issues across repos today.`;
  }
}

export type StatTrendDetailProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  icon: ReactNode;
  value: number;
  color: string;
  trendKey: TrendMetricKey;
  granularity: TrendGranularity;
  chartPoints: TrendPoint[];
  trendsPending: boolean;
  organization: string;
};

export function StatTrendDetailDialog({
  open,
  onClose,
  label,
  icon,
  value,
  color,
  trendKey,
  granularity,
  chartPoints,
  trendsPending,
  organization,
}: StatTrendDetailProps) {
  const theme = useTheme();
  const series = sparkSeries(chartPoints, trendKey);
  const periodLabels = periodLabelsFromPoints(chartPoints, granularity);
  const trendInsight =
    granularity === "year"
      ? describeLatestYearTrend(series, periodLabels, statTrendItemLabel(trendKey))
      : describeLatestMonthTrend(series, periodLabels, statTrendItemLabel(trendKey));

  const periodNoun = granularity === "year" ? "Year" : "Month";
  const totalActivity = series.reduce((sum, n) => sum + n, 0);
  const peak = series.length > 0 ? Math.max(...series) : 0;
  const peakIndex = peak > 0 ? series.indexOf(peak) : -1;
  const peakLabel = peakIndex >= 0 ? periodLabels[peakIndex] : "—";

  const rows = chartPoints.map((point, i) => {
    const count = series[i] ?? 0;
    const prev = i > 0 ? (series[i - 1] ?? 0) : null;
    let change = "—";
    if (prev !== null) {
      const delta = count - prev;
      if (delta === 0) change = "0";
      else change = `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;
    }
    return {
      period: periodLabels[i] ?? point.month,
      count,
      change,
    };
  });

  const hasActivity = series.some(v => v > 0);
  const chartHeight = 340;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box sx={{ color, display: "flex" }}>{icon}</Box>
          <Box>
            <Typography variant="h6" component="span">
              {label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {granularity === "year" ? "Yearly trend" : "Monthly trend"} · {organization}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Current total
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {value.toLocaleString()}
            </Typography>
          </Box>

          {trendInsight && <TrendInsightBanner insight={trendInsight} color={color} />}

          <Typography variant="body2" color="text.secondary">
            {statDescription(trendKey, granularity, organization)}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {granularity === "year" ? "Sum over years shown" : "Sum over months shown"}
              </Typography>
              <Typography variant="h6" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {totalActivity.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Peak {periodNoun.toLowerCase()}
              </Typography>
              <Typography variant="h6">
                {peakLabel} ({peak.toLocaleString()})
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Periods shown
              </Typography>
              <Typography variant="h6">{series.length}</Typography>
            </Box>
          </Stack>

          {trendsPending ? (
            <Skeleton variant="rounded" height={chartHeight} />
          ) : hasActivity ? (
            <Box
              sx={{
                width: "100%",
                height: chartHeight,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                p: 1,
                bgcolor: alpha(color, theme.palette.mode === "light" ? 0.04 : 0.1),
              }}
            >
              <LineChart
                height={chartHeight - 16}
                margin={{ top: 24, bottom: 48, left: 56, right: 24 }}
                xAxis={[
                  {
                    scaleType: "point",
                    data: periodLabels,
                    tickLabelStyle: { fontSize: 12 },
                  },
                ]}
                yAxis={[
                  {
                    width: 52,
                    tickLabelStyle: { fontSize: 12 },
                    valueFormatter: formatAxisCount,
                  },
                ]}
                series={[
                  {
                    data: series,
                    label: label,
                    color,
                    area: true,
                    curve: "natural",
                    showMark: true,
                  },
                ]}
                grid={{ horizontal: true }}
                sx={{
                  width: "100%",
                  "& .MuiAreaElement-root": { fillOpacity: 0.22 },
                  "& .MuiLineElement-root": { strokeWidth: 2.5 },
                }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                height: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
              }}
            >
              <Typography color="text.secondary">No activity in this period range</Typography>
            </Box>
          )}

          <TableContainer>
            <Typography variant="subtitle2" gutterBottom>
              Period breakdown
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{periodNoun}</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">Change vs prior</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.period} hover>
                    <TableCell>{row.period}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {row.count.toLocaleString()}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.change}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
