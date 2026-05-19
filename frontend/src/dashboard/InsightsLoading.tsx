import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const BAR_HEIGHTS = [48, 72, 56, 88, 64, 40];

function BarChartSkeleton({ height }: { height: number }) {
  return (
    <Box
      sx={{
        height,
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        px: 1,
        pt: 2,
        borderRadius: 1,
        bgcolor: theme => (theme.palette.mode === "light" ? "grey.50" : "grey.900"),
      }}
    >
      {BAR_HEIGHTS.map((h, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          animation="wave"
          sx={{ flex: 1, height: h, borderRadius: "4px 4px 0 0" }}
        />
      ))}
    </Box>
  );
}

function InsightItemSkeleton() {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.5,
        py: 1.25,
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        borderRadius: 1.5,
        bgcolor: "background.paper",
      }}
    >
      <Skeleton variant="rounded" width={44} height={26} animation="wave" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="92%" height={20} animation="wave" />
        <Skeleton variant="text" width="40%" height={16} animation="wave" sx={{ mt: 0.75 }} />
      </Box>
      <Skeleton variant="rounded" width={32} height={32} animation="wave" />
    </Paper>
  );
}

type InsightsLoadingProps = {
  label?: string;
};

/** Skeleton layout matching the populated upstream insights panel. */
export function InsightsLoading({ label = "Fetching insights from GitHub…" }: InsightsLoadingProps) {
  return (
    <Fade in timeout={300}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <Skeleton variant="rounded" width={72} height={24} animation="wave" />
          <Skeleton variant="rounded" width={140} height={24} animation="wave" />
          <Skeleton variant="rounded" width={100} height={24} animation="wave" />
        </Stack>

        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Skeleton variant="rounded" width={128} height={32} animation="wave" />
          </Stack>
          <Skeleton
            variant="rounded"
            height={72}
            animation="wave"
            sx={{ borderRadius: 1 }}
          />
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Skeleton variant="text" width="75%" height={22} animation="wave" sx={{ mb: 1.5 }} />
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Skeleton variant="circular" width={180} height={180} animation="wave" />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Skeleton variant="text" width="55%" height={22} animation="wave" sx={{ mb: 1 }} />
              <Skeleton variant="text" width="85%" height={16} animation="wave" sx={{ mb: 1.5 }} />
              <BarChartSkeleton height={220} />
              <Skeleton variant="text" width="70%" height={14} animation="wave" sx={{ mt: 1 }} />
            </Grid>
          </Grid>
        </Paper>

        <Box>
          <Skeleton variant="text" width={220} height={22} animation="wave" sx={{ mb: 1 }} />
          <Stack spacing={1} sx={{ maxHeight: 280 }}>
            <InsightItemSkeleton />
            <InsightItemSkeleton />
            <InsightItemSkeleton />
          </Stack>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", pt: 0.5 }}>
          {label}
        </Typography>
      </Stack>
    </Fade>
  );
}
