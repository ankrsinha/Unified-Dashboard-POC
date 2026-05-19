package github

import (
	"context"
	"fmt"
	"time"

	gh "github.com/google/go-github/v69/github"
)

type Issue struct {
	ID         int64    `json:"id"`
	Number     int      `json:"number"`
	Title      string   `json:"title"`
	HTMLURL    string   `json:"html_url"`
	State      string   `json:"state"`
	Labels     []string `json:"labels"`
	CreatedAt  string   `json:"created_at,omitempty"`
	UpdatedAt  string   `json:"updated_at,omitempty"`
	Comments   int      `json:"comments"`
	Body       string   `json:"body,omitempty"`
	Complexity string   `json:"complexity,omitempty"`
}

var goodFirstLabels = []string{
	"good first issue",
	"good-first-issue",
	"beginner friendly",
}

func (c *Client) ListGoodFirstIssues(ctx context.Context, owner, repo string) ([]Issue, error) {
	seen := make(map[int64]struct{})
	out := make([]Issue, 0)

	for _, label := range goodFirstLabels {
		issues, err := c.listIssuesByLabel(ctx, owner, repo, label)
		if err != nil {
			return nil, err
		}
		for _, issue := range issues {
			if _, ok := seen[issue.ID]; ok {
				continue
			}
			seen[issue.ID] = struct{}{}
			out = append(out, issue)
		}
	}
	return out, nil
}

func (c *Client) listIssuesByLabel(ctx context.Context, owner, repo, label string) ([]Issue, error) {
	opts := &gh.IssueListByRepoOptions{
		State:  "open",
		Labels: []string{label},
		ListOptions: gh.ListOptions{
			PerPage: 100,
		},
	}

	var out []Issue
	for {
		issues, resp, err := c.api.Issues.ListByRepo(ctx, owner, repo, opts)
		if err != nil {
			return nil, fmt.Errorf("list issues: %w", err)
		}
		for _, i := range issues {
			if i.PullRequestLinks != nil {
				continue
			}
			out = append(out, mapIssue(i))
		}
		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}
	return out, nil
}

func mapIssue(i *gh.Issue) Issue {
	issue := Issue{
		ID:       i.GetID(),
		Number:   i.GetNumber(),
		Title:    i.GetTitle(),
		HTMLURL:  i.GetHTMLURL(),
		State:    i.GetState(),
		Comments: i.GetComments(),
		Body:     i.GetBody(),
	}
	if i.CreatedAt != nil {
		issue.CreatedAt = i.CreatedAt.Format(time.RFC3339)
	}
	if i.UpdatedAt != nil {
		issue.UpdatedAt = i.UpdatedAt.Format(time.RFC3339)
	}
	for _, l := range i.Labels {
		issue.Labels = append(issue.Labels, l.GetName())
	}
	return issue
}
