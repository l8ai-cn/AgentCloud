package main

import (
	"net/http"
	"strings"

	"github.com/rs/cors"
)

// withBrowserCORS splits the browser surface in two because the two halves have
// different trust anchors: first-party consoles are pinned to an operator
// allowlist, while the embed surface is reached from partner pages whose origins
// are declared per grant (embed_context.parent_origins) and can therefore never
// be enumerated in server config.
func withBrowserCORS(allowedOrigins []string, handler http.Handler) http.Handler {
	firstParty := cors.New(firstPartyCORSOptions(allowedOrigins)).Handler(handler)
	embed := cors.New(embedCORSOptions()).Handler(handler)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isEmbedBrowserPath(r.URL.Path) {
			embed.ServeHTTP(w, r)
			return
		}
		firstParty.ServeHTTP(w, r)
	})
}

func firstPartyCORSOptions(allowedOrigins []string) cors.Options {
	allowedSet, wildcardAll := browserAllowedOrigins(allowedOrigins)
	return cors.Options{
		AllowedMethods: browserAllowedMethods(),
		AllowedHeaders: append(
			browserAllowedHeaders(),
			"Connect-Protocol-Version",
			"Connect-Timeout-Ms",
			"X-Organization-Slug",
			"X-API-Key",
		),
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           600,
		AllowOriginFunc: func(origin string) bool {
			if wildcardAll {
				return true
			}
			if _, ok := allowedSet[origin]; ok {
				return true
			}
			return origin == "null" || strings.HasPrefix(origin, "file://")
		},
	}
}

// Embed requests authenticate with a short-lived bearer token and never with
// cookies, so credentials stay off and any origin may preflight: authorization
// comes from the token, not from the caller's origin.
func embedCORSOptions() cors.Options {
	return cors.Options{
		AllowedMethods:   browserAllowedMethods(),
		AllowedHeaders:   browserAllowedHeaders(),
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           600,
		AllowOriginFunc:  func(string) bool { return true },
	}
}

func browserAllowedMethods() []string {
	return []string{
		http.MethodGet,
		http.MethodHead,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
		http.MethodOptions,
	}
}

func browserAllowedHeaders() []string {
	return []string{"Origin", "Content-Type", "Accept", "Authorization"}
}

func isEmbedBrowserPath(path string) bool {
	path = strings.TrimPrefix(path, "/api")
	return strings.HasPrefix(path, "/v1/embed/") ||
		strings.HasPrefix(path, "/v1/embed-contexts/")
}

func browserAllowedOrigins(allowedOrigins []string) (map[string]struct{}, bool) {
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"*"}
	}
	allowedSet := make(map[string]struct{}, len(allowedOrigins))
	wildcardAll := false
	for _, origin := range allowedOrigins {
		allowedSet[origin] = struct{}{}
		wildcardAll = wildcardAll || origin == "*"
	}
	return allowedSet, wildcardAll
}
