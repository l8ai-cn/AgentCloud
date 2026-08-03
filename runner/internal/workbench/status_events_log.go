package workbench

import (
	agentworkbenchv2 "github.com/l8ai-cn/agentcloud/proto/gen/go/agent_workbench/v2"
)

func (m *Mapper) Log(
	level, message string,
) *agentworkbenchv2.RunnerWorkbenchEventBatch {
	// ACP stderr/info is process bootstrap noise (model=, tools registered,
	// session restore). Keep it on the relay log channel, not the conversation.
	if !conversationFacingLogLevel(level) {
		return nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	itemID := m.nextItemIDLocked("log")
	block := &agentworkbenchv2.ContentBlock{
		ContentId: itemID + ":log",
		Identity:  contentIdentity("content.log"),
		Content: &agentworkbenchv2.ContentBlock_Log{
			Log: &agentworkbenchv2.LogContent{Level: level, Message: message},
		},
	}
	content := &agentworkbenchv2.TimelineItemContent{
		Content: &agentworkbenchv2.TimelineItemContent_System{
			System: &agentworkbenchv2.SystemTimelineItem{
				Content: []*agentworkbenchv2.ContentBlock{block},
			},
		},
	}
	source := map[string]string{"level": level, "message": message}
	return m.batchLocked(
		source,
		timelineMutation(
			agentworkbenchv2.RunnerTimelineOperation_RUNNER_TIMELINE_OPERATION_APPEND,
			itemID,
			content,
		),
	)
}

func conversationFacingLogLevel(level string) bool {
	switch level {
	case "warn", "warning", "error":
		return true
	default:
		return false
	}
}
