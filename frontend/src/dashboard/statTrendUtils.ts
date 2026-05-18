import type { TrendPoint } from "../api/client";

export type TrendMetricKey = "repos" | "stars" | "open_prs" | "open_issues";

export type TrendDirection = "up" | "down" | "flat";

export type MonthTrendInsight = {
  pct: number;
  label: string;
  direction: TrendDirection;
  currentCount: number;
  previousCount: number;
  delta: number;
  currentMonth: string;
  previousMonth: string;
  /** One sentence a user can read without knowing what MoM means. */
  summary: string;
};

export function sparkSeries(points: TrendPoint[], key: TrendMetricKey): number[] {
  if (points.length === 0) return [0, 0, 0, 0, 0, 0];
  return points.map(p => p[key]);
}

export function formatMonthShort(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return yearMonth;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function monthLabelsFromPoints(points: TrendPoint[]): string[] {
  return points.map(p => formatMonthShort(p.month));
}

function trendDirection(delta: number): TrendDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function formatPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/** Compare the last two months — used for stat cards and accordion header. */
export function describeLatestMonthTrend(
  counts: number[],
  monthLabels: string[],
  itemLabel = "items",
): MonthTrendInsight | null {
  if (counts.length < 2 || monthLabels.length !== counts.length) return null;

  const i = counts.length - 1;
  const currentCount = counts[i] ?? 0;
  const previousCount = counts[i - 1] ?? 0;
  const currentMonth = monthLabels[i] ?? "Latest";
  const previousMonth = monthLabels[i - 1] ?? "prior month";
  const delta = currentCount - previousCount;
  const direction = trendDirection(delta);

  let pct = 0;
  if (previousCount === 0) {
    pct = currentCount === 0 ? 0 : 100;
  } else {
    pct = Math.round((delta / previousCount) * 100);
  }

  const label = formatPct(pct);

  let summary: string;
  if (delta === 0) {
    summary = `${currentMonth}: ${currentCount} ${itemLabel} — unchanged from ${previousMonth}`;
  } else if (delta > 0) {
    summary = `${currentMonth}: ${currentCount} ${itemLabel} — ${delta} more than ${previousMonth} (${label})`;
  } else {
    summary = `${currentMonth}: ${currentCount} ${itemLabel} — ${Math.abs(delta)} fewer than ${previousMonth} (${label})`;
  }

  return {
    pct,
    label,
    direction,
    currentCount,
    previousCount,
    delta,
    currentMonth,
    previousMonth,
    summary,
  };
}

/** @deprecated Use describeLatestMonthTrend for readable copy. */
export function monthOverMonthChange(data: number[]): { pct: number; label: string } | null {
  const insight = describeLatestMonthTrend(
    data,
    data.map((_, index) => `Month ${index + 1}`),
  );
  if (!insight) return null;
  return { pct: insight.pct, label: insight.label };
}
