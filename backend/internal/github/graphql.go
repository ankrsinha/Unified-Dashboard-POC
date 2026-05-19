package github

import (
	"context"
	"fmt"
	"time"

	"github.com/shurcooL/githubv4"
)

// EnrichRepositoryReleases fills latest release (and open PR total when REST missed it) via GraphQL.
// Stale counts are loaded per repo from /insights when the accordion opens.
func (c *Client) EnrichRepositoryReleases(ctx context.Context, org string, repos []Repository) error {
	if c.gql == nil || len(repos) == 0 {
		return nil
	}

	byName := make(map[string]*Repository, len(repos))
	for i := range repos {
		byName[repos[i].Name] = &repos[i]
	}

	var cursor *githubv4.String

	for {
		var q struct {
			Organization struct {
				Repositories struct {
					Nodes []struct {
						Name          string
						PullRequests  struct {
							TotalCount int
						} `graphql:"pullRequests(states: OPEN)"`
						LatestRelease *struct {
							PublishedAt githubv4.DateTime
							TagName     string
							URL         string `graphql:"url"`
						}
					}
					PageInfo struct {
						EndCursor   githubv4.String
						HasNextPage bool
					}
				} `graphql:"repositories(first: 50, after: $cursor, orderBy: {field: NAME, direction: ASC})"`
			} `graphql:"organization(login: $org)"`
		}

		variables := map[string]interface{}{
			"org":    githubv4.String(org),
			"cursor": cursor,
		}
		if err := c.gql.Query(ctx, &q, variables); err != nil {
			return fmt.Errorf("graphql org repositories: %w", err)
		}

		for _, node := range q.Organization.Repositories.Nodes {
			repo, ok := byName[node.Name]
			if !ok {
				continue
			}
			if node.LatestRelease != nil && !node.LatestRelease.PublishedAt.IsZero() {
				repo.LastReleaseAt = node.LatestRelease.PublishedAt.Format(time.RFC3339)
				repo.LastReleaseTag = node.LatestRelease.TagName
				repo.LastReleaseURL = node.LatestRelease.URL
			}
			if node.PullRequests.TotalCount > 0 && repo.OpenPullRequests == 0 {
				repo.OpenPullRequests = node.PullRequests.TotalCount
			}
		}

		if !q.Organization.Repositories.PageInfo.HasNextPage {
			break
		}
		cursor = &q.Organization.Repositories.PageInfo.EndCursor
	}

	return nil
}
