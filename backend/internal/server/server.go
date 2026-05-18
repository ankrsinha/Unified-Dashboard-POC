package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/unified-dashboard/backend/internal/config"
	"github.com/unified-dashboard/backend/internal/handler"
)

func New(cfg config.Config, h *handler.Handler) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(180 * time.Second))
	r.Use(slogMiddleware)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "PUT", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.Health)
		r.Get("/hello", h.Hello)
		r.Put("/hello", h.Hello)

		r.Get("/repositories", h.ListRepositories)
		r.Get("/organizations/{org}/repositories", h.ListOrgRepositories)
		r.Get("/repositories/{owner}/{name}/good-first-issues", h.ListGoodFirstIssues)
		r.Get("/repositories/{owner}/{name}/tracking", h.RepoTracking)
		r.Get("/repositories/{owner}/{name}/insights", h.RepoInsights)
		r.Get("/tracking/summary", h.TrackingSummary)
		r.Get("/tracking/trends", h.TrackingTrends)
	})

	return r
}

func slogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"bytes", ww.BytesWritten(),
			"duration", time.Since(start),
		)
	})
}
