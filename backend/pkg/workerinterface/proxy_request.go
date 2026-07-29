// Package workerinterface encodes the wire contract between an HTTP surface and
// the runner's sandbox_fs "http_proxy" op. Both the API-key (ext) surface and
// the embed-token (session) surface must produce identical payloads, otherwise a
// skill service would see different requests depending on who called it.
package workerinterface

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

const MaxBodyBytes = 8 << 20

var (
	ErrInvalidID       = errors.New("invalid interface id")
	ErrInvalidPath     = errors.New("invalid interface path")
	ErrBodyUnreadable  = errors.New("failed to read request body")
	ErrBodyTooLarge    = errors.New("request body exceeds maximum size")
	ErrInvalidResponse = errors.New("invalid interface proxy response")
)

type requestPayload struct {
	Method  string              `json:"method"`
	Path    string              `json:"path"`
	Query   string              `json:"query"`
	Headers map[string][]string `json:"headers"`
	BodyB64 string              `json:"body_b64"`
}

func ValidateID(id string) error {
	if id == "" || len(id) < 2 || len(id) > 100 {
		return ErrInvalidID
	}
	for _, r := range id {
		if (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' {
			return ErrInvalidID
		}
	}
	return nil
}

func ValidatePath(path string) error {
	if path == "" {
		return nil
	}
	if !strings.HasPrefix(path, "/") || strings.Contains(path, "..") ||
		strings.Contains(path, `\`) {
		return ErrInvalidPath
	}
	return nil
}

func EncodeRequest(r *http.Request, path string) (string, error) {
	if err := ValidatePath(path); err != nil {
		return "", err
	}
	if path == "" {
		path = "/"
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, MaxBodyBytes+1))
	if err != nil {
		return "", ErrBodyUnreadable
	}
	if len(body) > MaxBodyBytes {
		return "", ErrBodyTooLarge
	}
	encoded, err := json.Marshal(requestPayload{
		Method:  r.Method,
		Path:    path,
		Query:   r.URL.RawQuery,
		Headers: forwardableHeaders(r.Header),
		BodyB64: base64.StdEncoding.EncodeToString(body),
	})
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

// Credentials stay on the platform edge: the skill service authorizes nothing,
// so leaking a caller's API key or embed token into the pod would be a
// privilege escalation path.
func forwardableHeaders(header http.Header) map[string][]string {
	out := make(map[string][]string, len(header))
	for key, values := range header {
		if SkipHopByHopHeader(key) ||
			strings.EqualFold(key, "Authorization") ||
			strings.EqualFold(key, "Cookie") ||
			strings.EqualFold(key, "X-Api-Key") {
			continue
		}
		out[key] = append([]string(nil), values...)
	}
	return out
}

func SkipHopByHopHeader(key string) bool {
	switch strings.ToLower(key) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
		"te", "trailers", "transfer-encoding", "upgrade", "host", "content-length":
		return true
	default:
		return false
	}
}
