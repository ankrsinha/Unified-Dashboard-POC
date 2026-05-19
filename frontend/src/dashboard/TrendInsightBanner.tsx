import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { MonthTrendInsight } from "./statTrendUtils";

type TrendInsightBannerProps = {
  insight: MonthTrendInsight;
  /** Matches the selected segment color in the workload donut chart. */
  color: string;
};

export function TrendInsightBanner({ insight, color }: TrendInsightBannerProps) {
  const Icon =
    insight.direction === "up"
      ? TrendingUpIcon
      : insight.direction === "down"
        ? TrendingDownIcon
        : TrendingFlatIcon;

  return (
    <Alert
      variant="outlined"
      icon={<Icon fontSize="small" />}
      sx={{
        mb: 0,
        borderColor: alpha(color, 0.45),
        bgcolor: theme => alpha(color, theme.palette.mode === "light" ? 0.08 : 0.16),
        color: "text.primary",
        "& .MuiAlert-icon": { color },
        "& .MuiAlert-message": { width: "100%" },
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25, color }}>
        Latest month trend
      </Typography>
      <Typography variant="body2">{insight.summary}</Typography>
    </Alert>
  );
}
