package acp

import (
	"encoding/json"
	"log/slog"
	"testing"
)

func TestHandlerAgentErrorMessageFiresOnError(t *testing.T) {
	var gotContent string
	var gotError string
	h := NewHandler(EventCallbacks{
		OnContentChunk: func(_ string, chunk ContentChunk) {
			gotContent = chunk.Text
		},
		OnError: func(err error) {
			gotError = err.Error()
		},
	}, slog.Default())

	payload, _ := json.Marshal(map[string]any{
		"sessionId": "session-1",
		"update": map[string]any{
			"sessionUpdate": "agent_message",
			"content": map[string]any{
				"type": "text",
				"text": "执行失败：Agent error: upstream unavailable",
			},
		},
	})

	h.HandleNotification("session/update", payload)

	if gotContent != "执行失败：Agent error: upstream unavailable" {
		t.Fatalf("content = %q", gotContent)
	}
	if gotError != "执行失败：Agent error: upstream unavailable" {
		t.Fatalf("error = %q", gotError)
	}
}
