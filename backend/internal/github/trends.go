package github

import (
	"context"
	"log/slog"
	"sort"
	"strings"
	"time"
)

const defaultTrendMonths = 6

type TrendPoint struct {
	Month      string `json:"month"`
	Repos      int    `json:"repos"`
	Stars      int    `json:"stars"`
	OpenPRs    int    `json:"open_prs"`
	OpenIssues int    `json:"open_issues"`
}

type OrgTrends struct {
	Organization    string       `json:"organization"`
	Points          []TrendPoint `json:"points"`
	Partial         bool         `json:"partial"`
	SearchFailures  int          `json:"search_failures"`
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

	searchDelay := 400 * time.Millisecond
	if !c.authenticated {
		searchDelay = time.Second
	}

	var searchFailures int
	rateLimited := false

	for i := range buckets {
		if rateLimited {
			searchFailures += 2
			continue
		}

		key := buckets[i].Month
		start, end, err := monthBounds(key)
		if err != nil {
			slog.Warn("trends month bounds", "month", key, "error", err)
			searchFailures += 2
			continue
		}

		if err := sleepCtx(ctx, searchDelay); err != nil {
			break
		}
		prs, err := c.searchIssueCount(ctx, "org:"+org+" is:pr created:"+start+".."+end)
		if err != nil {
			searchFailures++
			if isRateLimitErr(err) {
				rateLimited = true
			}
			slog.Warn("trends pr search failed", "org", org, "month", key, "error", err)
		} else {
			buckets[i].OpenPRs = prs
		}

		if rateLimited {
			searchFailures++
			continue
		}

		if err := sleepCtx(ctx, searchDelay); err != nil {
			break
		}
		issues, err := c.searchIssueCount(ctx, "org:"+org+" is:issue created:"+start+".."+end)
		if err != nil {
			searchFailures++
			if isRateLimitErr(err) {
				rateLimited = true
			}
			slog.Warn("trends issue search failed", "org", org, "month", key, "error", err)
		} else {
			buckets[i].OpenIssues = issues
		}
	}

	sort.Slice(buckets, func(i, j int) bool { return buckets[i].Month < buckets[j].Month })

	partial := searchFailures > 0
	return OrgTrends{
		Organization:   org,
		Points:         buckets,
		Partial:        partial,
		SearchFailures: searchFailures,
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
