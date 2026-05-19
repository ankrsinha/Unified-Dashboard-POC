export const queryKeys = {
  repositories: (aiMode: boolean) => ["repositories", { aiMode }] as const,
  trackingTrends: (aiMode: boolean) => ["tracking-trends", { aiMode }] as const,
  repoInsights: (owner: string, name: string, refresh: boolean, aiMode: boolean) =>
    ["repo-insights", owner, name, refresh, aiMode] as const,
};
