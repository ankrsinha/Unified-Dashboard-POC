package llm

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

const batchSize = 25

type Client struct {
	apiKey     string
	httpClient *http.Client
	model      string
	cache      *batchCache
}

func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: &http.Client{Timeout: 120 * time.Second},
		model:      "gemini-2.0-flash",
		cache:      newBatchCache(2 * time.Hour),
	}
}

func (c *Client) Enabled() bool {
	return c.apiKey != ""
}

func (c *Client) CacheStats() (entries, expired int) {
	return c.cache.stats()
}

type IssueInput struct {
	Number int    `json:"number"`
	Title  string `json:"title"`
	Body   string `json:"body"`
}

type issueComplexityResult struct {
	Number     int    `json:"number"`
	Complexity string `json:"complexity"`
}

// AnalyzeIssueComplexity splits issues into stable, content-addressed batches.
// Each batch is fingerprinted — only batches whose content actually changed
// trigger an LLM call. Unchanged batches return instantly from the cache.
func (c *Client) AnalyzeIssueComplexity(ctx context.Context, repoDescription, readmeContent string, issues []IssueInput) (map[int]string, error) {
	if !c.Enabled() || len(issues) == 0 {
		return map[int]string{}, nil
	}

	readme := readmeContent
	if len(readme) > 4000 {
		readme = readme[:4000] + "\n... (truncated)"
	}

	prepared := prepareIssues(issues)

	// Stable context fingerprint (repo desc + readme) shared by all batches.
	contextHash := hashString(repoDescription + "\n" + readme)
	batches := splitIntoBatches(prepared, batchSize)

	var (
		mu     sync.Mutex
		merged = make(map[int]string, len(prepared))
		wg     sync.WaitGroup
		errors []error
		hits   int
		misses int
	)

	for i, batch := range batches {
		contentHash := batchContentHash(contextHash, batch)

		if cached, ok := c.cache.get(contentHash); ok {
			mu.Lock()
			hits++
			for k, v := range cached {
				merged[k] = v
			}
			mu.Unlock()
			continue
		}

		// Cache miss — call Gemini concurrently
		wg.Add(1)
		go func(idx int, chunk []IssueInput, hash string) {
			defer wg.Done()

			result, err := c.callGemini(ctx, repoDescription, readme, chunk)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				slog.Warn("LLM batch failed", "batch", idx, "size", len(chunk), "error", err)
				errors = append(errors, err)
				return
			}
			for k, v := range result {
				merged[k] = v
			}
			c.cache.set(hash, result)
			misses++
		}(i, batch, contentHash)
	}

	wg.Wait()

	if len(merged) == 0 && len(errors) > 0 {
		return nil, fmt.Errorf("all %d LLM batches failed; first: %w", len(errors), errors[0])
	}

	slog.Info("LLM complexity analysis done",
		"total_issues", len(prepared),
		"batches", len(batches),
		"cache_hits", hits,
		"llm_calls", misses,
		"failed", len(errors),
		"classified", len(merged),
	)
	return merged, nil
}

// prepareIssues sorts by number (stable batch boundaries) and trims bodies.
func prepareIssues(issues []IssueInput) []IssueInput {
	out := make([]IssueInput, len(issues))
	for i, issue := range issues {
		body := issue.Body
		if len(body) > 500 {
			body = body[:500] + "..."
		}
		out[i] = IssueInput{Number: issue.Number, Title: issue.Title, Body: body}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Number < out[j].Number })
	return out
}

func splitIntoBatches(issues []IssueInput, size int) [][]IssueInput {
	var batches [][]IssueInput
	for i := 0; i < len(issues); i += size {
		end := i + size
		if end > len(issues) {
			end = len(issues)
		}
		batches = append(batches, issues[i:end])
	}
	return batches
}

// batchContentHash produces a fingerprint of the repo context + the exact
// issue content in this batch. Same inputs → same hash → cache hit.
func batchContentHash(contextHash string, issues []IssueInput) string {
	h := sha256.New()
	h.Write([]byte(contextHash))
	for _, issue := range issues {
		fmt.Fprintf(h, "\n%d|%s|%s", issue.Number, issue.Title, issue.Body)
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func hashString(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])[:16]
}

// callGemini sends a single batch of issues to Gemini and parses the response.
func (c *Client) callGemini(ctx context.Context, repoDescription, readme string, issues []IssueInput) (map[int]string, error) {
	issuesJSON, _ := json.Marshal(issues)

	prompt := fmt.Sprintf(`You are an expert software engineer. Analyze GitHub issues and classify their complexity level.
For each issue, determine the difficulty level based on the issue title, description, and the repository context.

Classify each issue as exactly one of:
- "beginner" — Simple changes like documentation fixes, typos, config changes, adding tests for existing code, small UI tweaks
- "intermediate" — Moderate changes requiring understanding of the codebase, feature enhancements, bug fixes with some debugging needed
- "advanced" — Complex changes involving architecture, performance optimization, security fixes, cross-cutting concerns, or deep domain knowledge

Respond with a JSON array of objects with "number" (issue number) and "complexity" (one of: beginner, intermediate, advanced).
Respond ONLY with the JSON array, no markdown fences, no explanation.

Repository description: %s

Repository documentation (README):
%s

Issues to analyze:
%s`, repoDescription, readme, string(issuesJSON))

	endpoint := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		c.model, c.apiKey,
	)

	reqBody, _ := json.Marshal(geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
		GenerationConfig: geminiGenerationConfig{
			Temperature:      0.1,
			MaxOutputTokens:  4096,
			ResponseMimeType: "application/json",
		},
	})

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini API error %d: %s", resp.StatusCode, string(respBody))
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, fmt.Errorf("parse gemini envelope: %w", err)
	}
	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("no candidates in gemini response")
	}

	content := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var results []issueComplexityResult
	if err := json.Unmarshal([]byte(content), &results); err != nil {
		slog.Warn("failed to parse LLM batch response", "error", err, "content_len", len(content))
		return nil, fmt.Errorf("parse complexity results: %w", err)
	}

	out := make(map[int]string, len(results))
	for _, r := range results {
		switch r.Complexity {
		case "beginner", "intermediate", "advanced":
			out[r.Number] = r.Complexity
		default:
			slog.Warn("unexpected complexity value", "number", r.Number, "value", r.Complexity)
		}
	}
	return out, nil
}

// ─── Content-addressed batch cache ────────────────────────────────────────────

type batchCache struct {
	mu    sync.RWMutex
	items map[string]batchEntry
	ttl   time.Duration
}

type batchEntry struct {
	results map[int]string
	expiry  time.Time
}

func newBatchCache(ttl time.Duration) *batchCache {
	return &batchCache{items: make(map[string]batchEntry), ttl: ttl}
}

func (bc *batchCache) get(hash string) (map[int]string, bool) {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	e, ok := bc.items[hash]
	if !ok || time.Now().After(e.expiry) {
		return nil, false
	}
	return e.results, true
}

func (bc *batchCache) set(hash string, results map[int]string) {
	bc.mu.Lock()
	defer bc.mu.Unlock()

	// Periodic sweep: if the cache is large, drop expired entries.
	if len(bc.items) > 500 {
		now := time.Now()
		for k, v := range bc.items {
			if now.After(v.expiry) {
				delete(bc.items, k)
			}
		}
	}

	bc.items[hash] = batchEntry{results: results, expiry: time.Now().Add(bc.ttl)}
}

func (bc *batchCache) stats() (entries, expired int) {
	bc.mu.RLock()
	defer bc.mu.RUnlock()
	now := time.Now()
	for _, e := range bc.items {
		entries++
		if now.After(e.expiry) {
			expired++
		}
	}
	return
}

// ─── Gemini API types ─────────────────────────────────────────────────────────

type geminiRequest struct {
	Contents         []geminiContent        `json:"contents"`
	GenerationConfig geminiGenerationConfig `json:"generationConfig"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiGenerationConfig struct {
	Temperature      float64 `json:"temperature"`
	MaxOutputTokens  int     `json:"maxOutputTokens"`
	ResponseMimeType string  `json:"responseMimeType,omitempty"`
}

type geminiResponse struct {
	Candidates []geminiCandidate `json:"candidates"`
}

type geminiCandidate struct {
	Content geminiContent `json:"content"`
}
