package httpserver

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"

	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/config"
	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/taskstore"
)

type Envelope struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    any    `json:"data"`
	Code    int    `json:"code"`
}

type Server struct {
	apiKey []byte
	store  *taskstore.Store
}

func New(cfg config.Config, store *taskstore.Store) http.Handler {
	s := &Server{apiKey: []byte(cfg.APIKey), store: store}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("POST /api/v1/vehicle-booking/tasks", s.requireAPIKey(s.createTask))
	mux.HandleFunc("GET /api/v1/vehicle-booking/tasks/{task_id}", s.requireAPIKey(s.getTask))
	return mux
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, Envelope{Success: true, Message: "ok", Code: 200, Data: map[string]string{"status": "ok"}})
}

func (s *Server) requireAPIKey(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		got := []byte(r.Header.Get("X-API-Key"))
		if subtle.ConstantTimeCompare(got, s.apiKey) != 1 {
			writeJSON(w, http.StatusUnauthorized, Envelope{
				Success: false, Message: "Invalid API key", Code: 401,
			})
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, body Envelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
