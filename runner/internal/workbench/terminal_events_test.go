package workbench

import (
	"testing"

	agentworkbenchv2 "github.com/l8ai-cn/agentcloud/proto/gen/go/agent_workbench/v2"
	"github.com/stretchr/testify/require"
)

func TestTerminalSessionInitializedPublishesHostControlledTerminal(t *testing.T) {
	mapper := NewMapper("pod-1", "codex-cli")

	batch := mapper.TerminalSessionInitialized("main:tui")

	require.Len(t, batch.GetMutations(), 2)
	capabilities := batch.GetMutations()[0].GetCapabilities()
	require.NotNil(t, capabilities)
	require.Equal(t, []string{
		"terminal.input",
		"terminal.resize",
		"terminal.signal",
		"terminal.control",
	}, capabilities.GetTerminalOperations())
	require.True(t, capabilities.GetHistory())
	require.Len(t, capabilities.GetCommandSchemas(), 1)
	require.Equal(
		t,
		[]string{"session.send"},
		capabilities.GetCommandSchemas()[0].GetActions(),
	)

	resource := batch.GetMutations()[1].GetResource()
	require.NotNil(t, resource)
	require.Equal(t, TerminalResourceID, resource.GetResourceId())
	require.Equal(t, "main:tui", resource.GetLabel())
	require.Equal(
		t,
		agentworkbenchv2.SessionResourceStatus_SESSION_RESOURCE_STATUS_READY,
		resource.GetStatus(),
	)
	require.True(t, resource.GetTerminal().GetWritable())
	require.Equal(
		t,
		agentworkbenchv2.TerminalControlMode_TERMINAL_CONTROL_MODE_HOST,
		resource.GetTerminal().GetControlMode(),
	)
}

func TestTerminalStateMapsDetectorStatuses(t *testing.T) {
	for status, want := range map[string]agentworkbenchv2.SessionStatus{
		"executing": agentworkbenchv2.SessionStatus_SESSION_STATUS_RUNNING,
		"waiting":   agentworkbenchv2.SessionStatus_SESSION_STATUS_IDLE,
		"idle":      agentworkbenchv2.SessionStatus_SESSION_STATUS_IDLE,
		"exited":    agentworkbenchv2.SessionStatus_SESSION_STATUS_COMPLETED,
	} {
		t.Run(status, func(t *testing.T) {
			batch := NewMapper("pod-1", "codex-cli").TerminalState(status)

			require.Len(t, batch.GetMutations(), 1)
			require.Equal(t, want, batch.GetMutations()[0].GetStatus().GetStatus())
		})
	}
}

func TestTerminalStateRejectsUnknownStatus(t *testing.T) {
	batch := NewMapper("pod-1", "codex-cli").TerminalState("hibernating")

	require.Len(t, batch.GetMutations(), 1)
	require.NotNil(t, batch.GetMutations()[0].GetUnsupported())
	require.Nil(t, batch.GetMutations()[0].GetStatus())
}

func TestTerminalPromptAppendsCompletedUserMessage(t *testing.T) {
	batch := NewMapper("pod-1", "codex-cli").TerminalPrompt("跑一下测试")

	require.Len(t, batch.GetMutations(), 1)
	timeline := batch.GetMutations()[0].GetTimeline()
	require.NotNil(t, timeline)
	require.Equal(
		t,
		agentworkbenchv2.RunnerTimelineOperation_RUNNER_TIMELINE_OPERATION_APPEND,
		timeline.GetOperation(),
	)
	message := timeline.GetContent().GetMessage()
	require.Equal(t, agentworkbenchv2.MessageRole_MESSAGE_ROLE_USER, message.GetRole())
	require.Equal(
		t,
		agentworkbenchv2.TimelineItemStatus_TIMELINE_ITEM_STATUS_COMPLETED,
		message.GetStatus(),
	)
}
