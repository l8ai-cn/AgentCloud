package workbench

import (
	agentworkbenchv2 "github.com/l8ai-cn/agentcloud/proto/gen/go/agent_workbench/v2"
)

// PTY pods expose exactly one relay-backed terminal. Terminal bytes stay on the
// relay data plane, so the resource is host-controlled: the viewing surface owns
// the control lease instead of negotiating one through workbench commands.
const TerminalResourceID = "main"

func (m *Mapper) TerminalSessionInitialized(
	label string,
) *agentworkbenchv2.RunnerWorkbenchEventBatch {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.batchLocked(
		map[string]string{"resource_id": TerminalResourceID, "label": label},
		terminalCapabilitiesMutation(),
		terminalResourceMutation(label),
	)
}

func (m *Mapper) TerminalState(
	status string,
) *agentworkbenchv2.RunnerWorkbenchEventBatch {
	m.mu.Lock()
	defer m.mu.Unlock()
	source := map[string]string{"status": status}
	sessionStatus, ok := terminalSessionStatus(status)
	if !ok {
		return m.batchLocked(
			source,
			m.unsupportedMutationLocked("terminal.status", status),
		)
	}
	mutations := append(
		m.completeActiveTimelineLocked(),
		&agentworkbenchv2.RunnerWorkbenchMutation{
			Mutation: &agentworkbenchv2.RunnerWorkbenchMutation_Status{
				Status: &agentworkbenchv2.RunnerStatusMutation{Status: sessionStatus},
			},
		},
	)
	return m.batchLocked(source, mutations...)
}

// TerminalPrompt records a prompt the runner injected itself (pod creation, IM
// relays). Prompts issued as workbench commands are already projected by the
// backend, so echoing those here would duplicate the user bubble.
func (m *Mapper) TerminalPrompt(
	text string,
) *agentworkbenchv2.RunnerWorkbenchEventBatch {
	m.mu.Lock()
	defer m.mu.Unlock()
	itemID := m.nextItemIDLocked("message-user")
	content := &agentworkbenchv2.TimelineItemContent{
		Content: &agentworkbenchv2.TimelineItemContent_Message{
			Message: &agentworkbenchv2.MessageTimelineItem{
				Role:   agentworkbenchv2.MessageRole_MESSAGE_ROLE_USER,
				Status: agentworkbenchv2.TimelineItemStatus_TIMELINE_ITEM_STATUS_COMPLETED,
				Content: []*agentworkbenchv2.ContentBlock{
					markdownBlock(itemID, text),
				},
			},
		},
	}
	return m.batchLocked(
		map[string]string{"prompt": text},
		timelineMutation(
			agentworkbenchv2.RunnerTimelineOperation_RUNNER_TIMELINE_OPERATION_APPEND,
			itemID,
			content,
		),
	)
}

func terminalCapabilitiesMutation() *agentworkbenchv2.RunnerWorkbenchMutation {
	return &agentworkbenchv2.RunnerWorkbenchMutation{
		Mutation: &agentworkbenchv2.RunnerWorkbenchMutation_Capabilities{
			Capabilities: &agentworkbenchv2.SupportCapabilities{
				ProtocolVersion: "2",
				CommandSchemas: []*agentworkbenchv2.CapabilityDescriptor{
					commandCapability("send_prompt", "session.send"),
				},
				TerminalOperations: []string{
					"terminal.input",
					"terminal.resize",
					"terminal.signal",
					"terminal.control",
				},
				ArtifactOperations: []string{"artifact.download"},
				History:            true,
			},
		},
	}
}

func terminalResourceMutation(
	label string,
) *agentworkbenchv2.RunnerWorkbenchMutation {
	return &agentworkbenchv2.RunnerWorkbenchMutation{
		Mutation: &agentworkbenchv2.RunnerWorkbenchMutation_Resource{
			Resource: &agentworkbenchv2.SessionResource{
				ResourceId: TerminalResourceID,
				Label:      label,
				Status:     agentworkbenchv2.SessionResourceStatus_SESSION_RESOURCE_STATUS_READY,
				Resource: &agentworkbenchv2.SessionResource_Terminal{
					Terminal: &agentworkbenchv2.TerminalResource{
						Writable:    true,
						ControlMode: agentworkbenchv2.TerminalControlMode_TERMINAL_CONTROL_MODE_HOST,
					},
				},
			},
		},
	}
}

// Detector states describe the TUI agent, not a workbench turn: "waiting" means
// the agent accepts input, which is workbench idle.
func terminalSessionStatus(
	status string,
) (agentworkbenchv2.SessionStatus, bool) {
	switch status {
	case "executing":
		return agentworkbenchv2.SessionStatus_SESSION_STATUS_RUNNING, true
	case "waiting", "idle":
		return agentworkbenchv2.SessionStatus_SESSION_STATUS_IDLE, true
	case "exited":
		return agentworkbenchv2.SessionStatus_SESSION_STATUS_COMPLETED, true
	default:
		return agentworkbenchv2.SessionStatus_SESSION_STATUS_UNSPECIFIED, false
	}
}
