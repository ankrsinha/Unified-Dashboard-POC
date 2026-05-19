import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

const REPO_CARD_COUNT = 5;

function StatCardSkeleton() {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1.5 }}>
          <Skeleton variant="text" width="55%" height={20} animation="wave" />
          <Skeleton variant="circular" width={22} height={22} animation="wave" />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <Skeleton variant="text" width={72} height={40} animation="wave" />
          <Skeleton variant="rounded" width={64} height={24} animation="wave" />
        </Stack>
        <Skeleton variant="rounded" height={112} animation="wave" sx={{ borderRadius: 1.5 }} />
      </CardContent>
    </Card>
  );
}

export function RepositoryCardSkeleton() {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Skeleton variant="circular" width={32} height={32} animation="wave" sx={{ mt: 0.25 }} />
          <Skeleton variant="circular" width={40} height={40} animation="wave" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 2 }}
              sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between" }}
            >
              <Box sx={{ width: "100%", maxWidth: 280 }}>
                <Skeleton variant="text" width="70%" height={26} animation="wave" />
                <Skeleton variant="text" width="50%" height={16} animation="wave" sx={{ mt: 0.5 }} />
              </Box>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Skeleton variant="rounded" width={56} height={28} animation="wave" />
                <Skeleton variant="rounded" width={48} height={28} animation="wave" />
                <Skeleton variant="rounded" width={52} height={28} animation="wave" />
                <Skeleton variant="rounded" width={72} height={28} animation="wave" />
                <Skeleton variant="circular" width={32} height={32} animation="wave" />
              </Stack>
            </Stack>
            <Skeleton variant="text" width="95%" height={18} animation="wave" sx={{ mt: 1.25 }} />
            <Skeleton variant="text" width="80%" height={18} animation="wave" sx={{ mt: 0.5 }} />
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

function RepositoriesTableSkeleton() {
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
          <Skeleton variant="rounded" height={40} animation="wave" sx={{ flex: 1, borderRadius: 1 }} />
          <Skeleton variant="rounded" height={40} animation="wave" sx={{ width: { xs: "100%", sm: 220 }, borderRadius: 1 }} />
        </Stack>
        <Skeleton variant="text" width={280} height={18} animation="wave" sx={{ mt: 1 }} />
      </Box>
      <Box sx={{ flex: 1, overflow: "hidden", p: 2 }}>
        <Stack spacing={1.5}>
          {Array.from({ length: REPO_CARD_COUNT }, (_, i) => (
            <RepositoryCardSkeleton key={i} />
          ))}
        </Stack>
      </Box>
    </Paper>
  );
}

/** Skeleton for initial dashboard load — mirrors stat cards + repository list layout. */
export function DashboardLoading() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 2 }}>
      <Grid container spacing={2}>
        {Array.from({ length: 4 }, (_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCardSkeleton />
          </Grid>
        ))}
      </Grid>
      <RepositoriesTableSkeleton />
    </Box>
  );
}
