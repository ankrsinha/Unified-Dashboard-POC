import {
  fetchRepoInsights,
  type CategoryInsight,
  type LatestRelease,
} from "../api/client";

export type RepoInsightsLoadArg = {
  owner: string;
  name: string;
  refresh: boolean;
  aiMode: boolean;
};

export type RepoInsightsState = {
  categories: CategoryInsight[];
  latestRelease: LatestRelease | null;
  selectedKey: string;
  fromCache: boolean;
  error: string | null;
};

export const initialRepoInsightsState: RepoInsightsState = {
  categories: [],
  latestRelease: null,
  selectedKey: "good_first_issues",
  fromCache: false,
  error: null,
};

function defaultCategoryKey(list: CategoryInsight[]): string {
  return list.find(c => c.total > 0)?.key ?? list[0]?.key ?? "good_first_issues";
}

export async function loadRepoInsights(
  _previous: RepoInsightsState,
  { owner, name, refresh, aiMode }: RepoInsightsLoadArg,
): Promise<RepoInsightsState> {
  try {
    const { data, fromCache } = await fetchRepoInsights(owner, name, { refresh, aiMode });
    const list = Array.isArray(data.categories) ? data.categories : [];
    return {
      categories: list,
      latestRelease: data.latest_release ?? null,
      selectedKey: defaultCategoryKey(list),
      fromCache,
      error: null,
    };
  } catch (err) {
    return {
      ...initialRepoInsightsState,
      error: err instanceof Error ? err.message : "Failed to load insights",
    };
  }
}
