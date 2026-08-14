package httpserver

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/config"
	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/taskstore"
	"github.com/stretchr/testify/require"
)

func TestVehicleTaskContract(t *testing.T) {
	handler := New(config.Config{APIKey: "test-key"}, taskstore.New(1, taskstore.DriverStub))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/vehicle-booking/tasks", bytes.NewBufferString(
		`{"thread_id":"t1","user_id":"u1","booking_data":{"purpose":"meeting"},"username":"alice","password":"secret"}`,
	))
	req.Header.Set("X-API-Key", "test-key")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	require.Equal(t, http.StatusAccepted, rec.Code)

	var created Envelope
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&created))
	require.True(t, created.Success)
	require.Equal(t, 202, created.Code)
	taskID, _ := created.Data.(map[string]any)["task_id"].(string)
	require.NotEmpty(t, taskID)

	var got Envelope
	require.Eventually(t, func() bool {
		getReq := httptest.NewRequest(http.MethodGet, "/api/v1/vehicle-booking/tasks/"+taskID, nil)
		getReq.Header.Set("X-API-Key", "test-key")
		getRec := httptest.NewRecorder()
		handler.ServeHTTP(getRec, getReq)
		if getRec.Code != http.StatusOK {
			return false
		}
		got = Envelope{}
		if err := json.NewDecoder(getRec.Body).Decode(&got); err != nil {
			return false
		}
		data, _ := got.Data.(map[string]any)
		return data["status"] == "completed"
	}, time.Second, 10*time.Millisecond)

	raw, err := json.Marshal(got.Data)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "secret")
	require.NotContains(t, string(raw), "alice")
}

func TestRejectsMissingAPIKey(t *testing.T) {
	handler := New(config.Config{APIKey: "test-key"}, taskstore.New(1, taskstore.DriverStub))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/vehicle-booking/tasks", bytes.NewBufferString(
		`{"thread_id":"t1","user_id":"u1"}`,
	))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestGetUnknownTask(t *testing.T) {
	handler := New(config.Config{APIKey: "test-key"}, taskstore.New(1, taskstore.DriverStub))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vehicle-booking/tasks/missing", nil)
	req.Header.Set("X-API-Key", "test-key")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestHealth(t *testing.T) {
	handler := New(config.Config{APIKey: "test-key"}, taskstore.New(1, taskstore.DriverStub))
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
}
