package acp

import (
	"encoding/json"
)

// handleToolCall handles the initial tool_call update (status: pending/in_progress).
func (h *Handler) handleToolCall(sessionID string, data json.RawMessage) {
	var tc struct {
		ToolCallID string `json:"toolCallId"`
		Title      string `json:"title"`
		Status     string `json:"status"`
	}
	if err := json.Unmarshal(data, &tc); err != nil {
		h.logger.Warn("failed to parse tool_call", "error", err)
		return
	}
	status := tc.Status
	if status == "pending" || status == "" {
		status = "running"
	}
	if h.callbacks.OnToolCallUpdate != nil {
		h.callbacks.OnToolCallUpdate(sessionID, ToolCallUpdate{
			ToolCallID:    tc.ToolCallID,
			ToolName:      tc.Title,
			Status:        status,
			ArgumentsJSON: toolCallArgumentsJSON(data),
		})
	}
}

// handleToolCallUpdate handles tool_call_update (status changes, results).
func (h *Handler) handleToolCallUpdate(sessionID string, data json.RawMessage) {
	var tc struct {
		ToolCallID   string `json:"toolCallId"`
		Title        string `json:"title"`
		Status       string `json:"status"`
		ResultText   string `json:"resultText"`
		ErrorMessage string `json:"errorMessage"`
	}
	if err := json.Unmarshal(data, &tc); err != nil {
		h.logger.Warn("failed to parse tool_call_update", "error", err)
		return
	}
	if h.callbacks.OnToolCallUpdate != nil {
		h.callbacks.OnToolCallUpdate(sessionID, ToolCallUpdate{
			ToolCallID:    tc.ToolCallID,
			ToolName:      tc.Title,
			Status:        tc.Status,
			ArgumentsJSON: toolCallArgumentsJSON(data),
		})
	}
	if tc.Status == "completed" || tc.Status == "failed" {
		if h.callbacks.OnToolCallResult != nil {
			h.callbacks.OnToolCallResult(sessionID, ToolCallResult{
				ToolCallID:   tc.ToolCallID,
				ToolName:     tc.Title,
				Success:      tc.Status == "completed",
				ResultText:   tc.ResultText,
				ErrorMessage: tc.ErrorMessage,
			})
		}
	}
}

// ACP agents may put tool arguments under rawInput, arguments, or input.
func toolCallArgumentsJSON(data json.RawMessage) string {
	var raw struct {
		RawInput  json.RawMessage `json:"rawInput"`
		Arguments json.RawMessage `json:"arguments"`
		Input     json.RawMessage `json:"input"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return ""
	}
	for _, candidate := range []json.RawMessage{raw.RawInput, raw.Arguments, raw.Input} {
		if len(candidate) == 0 || string(candidate) == "null" {
			continue
		}
		return string(candidate)
	}
	return ""
}
