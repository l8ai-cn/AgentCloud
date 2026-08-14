package httpserver

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/taskstore"
)

type createTaskRequest struct {
	ThreadID    string          `json:"thread_id"`
	UserID      string          `json:"user_id"`
	AgentType   string          `json:"agent_type"`
	BookingData json.RawMessage `json:"booking_data"`
	Username    string          `json:"username"`
	Password    string          `json:"password"`
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	var req createTaskRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, Envelope{Success: false, Message: "invalid json", Code: 400})
		return
	}
	req.ThreadID = strings.TrimSpace(req.ThreadID)
	req.UserID = strings.TrimSpace(req.UserID)
	if req.ThreadID == "" || req.UserID == "" {
		writeJSON(w, http.StatusBadRequest, Envelope{
			Success: false, Message: "thread_id and user_id are required", Code: 400,
		})
		return
	}

	task := s.store.Create(taskstore.Job{
		ThreadID:    req.ThreadID,
		UserID:      req.UserID,
		AgentType:   req.AgentType,
		BookingData: append([]byte(nil), req.BookingData...),
		Username:    req.Username,
		Password:    req.Password,
	})
	slog.Info("vehicle booking task accepted", "task_id", task.ID, "thread_id", req.ThreadID, "user_id", req.UserID)
	writeJSON(w, http.StatusAccepted, Envelope{
		Success: true,
		Message: "任务已提交",
		Data:    map[string]string{"task_id": task.ID},
		Code:    202,
	})
}

func (s *Server) getTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("task_id")
	task, ok := s.store.Get(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, Envelope{
			Success: false, Message: "任务未找到: " + id, Code: 404,
		})
		return
	}
	writeJSON(w, http.StatusOK, Envelope{Success: true, Message: "获取成功", Data: task, Code: 200})
}
