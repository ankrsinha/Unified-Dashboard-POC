package handler

import (
	"net/http"
	"time"

	"github.com/unified-dashboard/backend/internal/cache"
	ghclient "github.com/unified-dashboard/backend/internal/github"
)

type trackingTrendsResponse struct {
	Organization   string                `json:"organization"`
	Points         []ghclient.TrendPoint `json:"points"`
	Partial        bool                  `json:"partial,omitempty"`
	Message        string                `json:"message,omitempty"`
}

func (h *Handler) TrackingTrends(w http.ResponseWriter, r *http.Request) {
	key := "tracking-trends:" + h.org

	resp, hit, err := getOrFetch(h, r, key, func() (trackingTrendsResponse, error) {
		ctx, cancel := contextWithTimeout(r, 180*time.Second)
		defer cancel()

		repos, _ := h.repositoriesForTrends()
		trends, err := h.github.OrgTrends(ctx, h.org, repos, 6)
		if err != nil {
			return trackingTrendsResponse{}, err
		}

		out := trackingTrendsResponse{
			Organization: trends.Organization,
			Points:       trends.Points,
			Partial:      trends.Partial,
		}
		if trends.Partial {
			out.Message = "Monthly PR and issue counts may be missing for some months due to GitHub search limits."
		}
		return out, nil
	})
	if err != nil {
		h.log.Error("failed org tracking trends", "org", h.org, "error", err)
		writeError(w, http.StatusBadGateway, "failed to fetch tracking trends from GitHub")
		return
	}

	h.writeCached(w, r, key, hit, resp)
}

// repositoriesForTrends reads the cached repo list only (filled by GET /api/repositories).
// Avoids a second ListOrgRepositories call that could time out or trip rate limits.
func (h *Handler) repositoriesForTrends() ([]ghclient.Repository, bool) {
	reposKey := "repos:" + h.org
	if cached, ok := cache.Get[repositoriesResponse](h.cache, reposKey); ok && len(cached.Repositories) > 0 {
		return cached.Repositories, true
	}
	return []ghclient.Repository{}, false
}
