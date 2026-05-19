package github

import (
	"context"
	"log/slog"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"
)

const defaultTrendMonths = 6
const trendsSearchConcurrency = 2

type TrendPoint struct {
	Month      string `json:"month"`
	Repos      int    `json:"repos"`
	Stars      int    `json:"stars"`
	OpenPRs    int    `json:"open_prs"`
	OpenIssues int    `json:"open_issues"`
}

type OrgTrends struct {
	Organization   string       `json:"organization"`
	Points         []TrendPoint `json:"points"`
	Partial        bool         `json:"partial"`
	SearchFailures int          `json:"search_failures"`
}

func (c *Client) OrgTrends(ctx context.Context, org string, repos []Repository, months int) (OrgTrends, error) {
	if months <= 0 {
		months = defaultTrendMonths
	}
	if months > 12 {
		months = 12
	}

	buckets := make([]TrendPoint, months)
	now := time.Now().UTC()
	for i := range buckets {
		t := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -(months-1-i), 0)
		buckets[i].Month = t.Format("2006-01")
	}

	reposByMonth := map[string]int{}
	starsByMonth := map[string]int{}
	for _, repo := range repos {
		t, ok := parseMonth(repo.CreatedAt)
		if !ok {
			continue
		}
		key := t.Format("2006-01")
		reposByMonth[key]++
		starsByMonth[key] += repo.Stars
	}

	for i := range buckets {
		key := buckets[i].Month
		buckets[i].Repos = reposByMonth[key]
		buckets[i].Stars = starsByMonth[key]
	}

	var searchFailures atomic.Int32
	var rateLimited atomic.Bool
	var mu sync.Mutex

	sem := make(chan struct{}, trendsSearchConcurrency)
	g, gctx := errgroup.WithContext(ctx)

	for i := range buckets {
		key := buckets[i].Month
		start, end, err := monthBounds(key)
		if err != nil {
			slog.Warn("trends month bounds", "month", key, "error", err)
			searchFailures.Add(2)
			continue
		}

		idx := i
		g.Go(func() error {
			if rateLimited.Load() {
				searchFailures.Add(1)
				return nil
			}
			select {
			case sem <- struct{}{}:
			case <-gctx.Done():
				return gctx.Err()
			}
			defer func() { <-sem }()

			prs, err := c.searchIssueCount(gctx, "org:"+org+" is:pr created:"+start+".."+end)
			if err != nil {
				searchFailures.Add(1)
				if isRateLimitErr(err) {
					rateLimited.Store(true)
				}
				slog.Warn("trends pr search failed", "org", org, "month", key, "error", err)
				return nil
			}
			mu.Lock()
			buckets[idx].OpenPRs = prs
			mu.Unlock()
			return nil
		})

		g.Go(func() error {
			if rateLimited.Load() {
				searchFailures.Add(1)
				return nil
			}
			select {
			case sem <- struct{}{}:
			case <-gctx.Done():
				return gctx.Err()
			}
			defer func() { <-sem }()

			issues, err := c.searchIssueCount(gctx, "org:"+org+" is:issue created:"+start+".."+end)
			if err != nil {
				searchFailures.Add(1)
				if isRateLimitErr(err) {
					rateLimited.Store(true)
				}
				slog.Warn("trends issue search failed", "org", org, "month", key, "error", err)
				return nil
			}
			mu.Lock()
			buckets[idx].OpenIssues = issues
			mu.Unlock()
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return OrgTrends{}, err
	}

	sort.Slice(buckets, func(i, j int) bool { return buckets[i].Month < buckets[j].Month })

	failures := int(searchFailures.Load())
	return OrgTrends{
		Organization:   org,
		Points:         buckets,
		Partial:        failures > 0,
		SearchFailures: failures,
	}, nil
}

func isRateLimitErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "rate limit") || strings.Contains(msg, "403") || strings.Contains(msg, "429")
}

func monthBounds(yearMonth string) (start, end string, err error) {
	t, err := time.Parse("2006-01", yearMonth)
	if err != nil {
		return "", "", err
	}
	start = time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	end = time.Date(t.Year(), t.Month()+1, 0, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	return start, end, nil
}
