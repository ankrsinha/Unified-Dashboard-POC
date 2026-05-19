package github

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	gh "github.com/google/go-github/v69/github"
	"github.com/shurcooL/githubv4"
	"golang.org/x/oauth2"
)

type Repository struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	FullName    string `json:"full_name"`
	Description string `json:"description,omitempty"`
	HTMLURL     string `json:"html_url"`
	CloneURL    string `json:"clone_url"`
	Language    string `json:"language,omitempty"`
	Stars       int    `json:"stargazers_count"`
	Forks       int    `json:"forks_count"`
	OpenIssues        int `json:"open_issues_count"`
	OpenPullRequests int    `json:"open_pull_requests_count"`
	LastReleaseAt    string `json:"last_release_at,omitempty"`
	LastReleaseTag       string `json:"last_release_tag,omitempty"`
	LastReleaseURL       string `json:"last_release_url,omitempty"`
	Private              bool   `json:"private"`
	Archived    bool   `json:"archived"`
	CreatedAt   string `json:"created_at,omitempty"`
	UpdatedAt   string `json:"updated_at,omitempty"`
}

type Client struct {
	api           *gh.Client
	gql           *githubv4.Client
	authenticated bool
}

func NewClient(token string) *Client {
	token = strings.TrimSpace(token)
	httpClient := &http.Client{Timeout: 60 * time.Second}
	authenticated := token != ""
	if authenticated {
		ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
		httpClient = oauth2.NewClient(context.Background(), ts)
	}
	var gql *githubv4.Client
	if authenticated {
		gql = githubv4.NewClient(httpClient)
	}
	return &Client{
		api:           gh.NewClient(httpClient),
		gql:           gql,
		authenticated: authenticated,
	}
}

func (c *Client) Authenticated() bool {
	return c.authenticated
}

func (c *Client) GetReadmeContent(ctx context.Context, owner, repo string) (string, error) {
	readme, _, err := c.api.Repositories.GetReadme(ctx, owner, repo, nil)
	if err != nil {
		return "", fmt.Errorf("get readme: %w", err)
	}
	content, err := readme.GetContent()
	if err != nil {
		return "", fmt.Errorf("decode readme: %w", err)
	}
	return content, nil
}

func (c *Client) GetRepoDescription(ctx context.Context, owner, repo string) (string, error) {
	r, _, err := c.api.Repositories.Get(ctx, owner, repo)
	if err != nil {
		return "", fmt.Errorf("get repo: %w", err)
	}
	return r.GetDescription(), nil
}

func (c *Client) LogRateLimit(ctx context.Context) {
	rl, _, err := c.api.RateLimits(ctx)
	if err != nil {
		slog.Warn("could not read github rate limit", "error", err)
		return
	}
	if rl.Core != nil {
		slog.Info("github rate limit",
			"authenticated", c.authenticated,
			"core_remaining", rl.Core.Remaining,
			"core_limit", rl.Core.Limit,
			"core_reset", rl.Core.Reset.Time.Format(time.RFC3339),
		)
	}
	if rl.Search != nil {
		slog.Info("github search rate limit",
			"search_remaining", rl.Search.Remaining,
			"search_limit", rl.Search.Limit,
			"search_reset", rl.Search.Reset.Time.Format(time.RFC3339),
		)
	}
}

func (c *Client) ListOrgRepositories(ctx context.Context, org string) ([]Repository, error) {
	opts := &gh.RepositoryListByOrgOptions{
		ListOptions: gh.ListOptions{PerPage: 100},
	}

	var out []Repository
	for {
		repos, resp, err := c.api.Repositories.ListByOrg(ctx, org, opts)
		if err != nil {
			return nil, fmt.Errorf("list org repositories: %w", err)
		}
		for _, r := range repos {
			out = append(out, mapRepository(r))
		}
		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}
	return out, nil
}

// FillOpenPullRequestCounts sets open_pull_requests_count on each repo (best-effort).
func (c *Client) FillOpenPullRequestCounts(ctx context.Context, repos []Repository) {
	for i := range repos {
		parts := strings.SplitN(repos[i].FullName, "/", 2)
		if len(parts) != 2 {
			continue
		}
		n, err := c.countOpenPRs(ctx, parts[0], parts[1])
		if err == nil {
			repos[i].OpenPullRequests = n
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(120 * time.Millisecond):
		}
	}
}

func mapRepository(r *gh.Repository) Repository {
	repo := Repository{
		ID:          r.GetID(),
		Name:        r.GetName(),
		FullName:    r.GetFullName(),
		Description: r.GetDescription(),
		HTMLURL:     r.GetHTMLURL(),
		CloneURL:    r.GetCloneURL(),
		Language:    r.GetLanguage(),
		Stars:       r.GetStargazersCount(),
		Forks:       r.GetForksCount(),
		OpenIssues:  r.GetOpenIssuesCount(),
		Private:     r.GetPrivate(),
		Archived:    r.GetArchived(),
	}
	if r.CreatedAt != nil {
		repo.CreatedAt = r.CreatedAt.Format(time.RFC3339)
	}
	if r.UpdatedAt != nil {
		repo.UpdatedAt = r.UpdatedAt.Format(time.RFC3339)
	}
	return repo
}
