package runner

import (
	"github.com/l8ai-cn/agentcloud/runner/internal/client"
	"github.com/l8ai-cn/agentcloud/runner/internal/logger"
	"github.com/l8ai-cn/agentcloud/runner/internal/terminal/detector"
)

const ptyTerminalLabel = "main:tui"

// PTY pods project the same workbench session as ACP pods so both interaction
// modes render through one conversation surface: the terminal is published as a
// session resource, TUI detector states drive session status, and workspace
// artifacts are scanned whenever the agent goes back to accepting input.
func wirePTYWorkbench(
	pod *Pod,
	initialPrompt string,
	sender client.ConnectionSender,
	adapterCandidates ...string,
) {
	forwarder, err := newPodWorkbenchForwarder(
		pod.PodKey,
		ptyAdapterID(adapterCandidates...),
		pod.WorkDir,
		sender,
	)
	if err != nil {
		logger.Pod().Error(
			"failed to initialize PTY workbench forwarder",
			"pod_key", pod.PodKey, "error", err,
		)
		return
	}
	pod.workbenchForwarder = forwarder
	forwarder.terminalSessionInitialized(ptyTerminalLabel)
	forwarder.terminalPrompt(initialPrompt)
	pod.SubscribeStateChange(
		"workbench-session-status",
		func(event detector.StateChangeEvent) {
			status, ok := detectorStatus(event.NewState)
			if !ok {
				return
			}
			forwarder.terminalState(status)
		},
	)
}

func ptyAdapterID(candidates ...string) string {
	for _, candidate := range candidates {
		if candidate != "" {
			return candidate
		}
	}
	return InteractionModePTY
}

func (f *podWorkbenchForwarder) terminalSessionInitialized(label string) {
	f.send(f.mapper.TerminalSessionInitialized(label))
}

func (f *podWorkbenchForwarder) terminalPrompt(text string) {
	if text == "" {
		return
	}
	f.send(f.mapper.TerminalPrompt(text))
}

func (f *podWorkbenchForwarder) terminalState(status string) {
	f.send(f.mapper.TerminalState(status))
	if status != detectorStatusWaiting && status != detectorStatusIdle {
		return
	}
	f.scanArtifacts()
}

const (
	detectorStatusExecuting = "executing"
	detectorStatusWaiting   = "waiting"
	detectorStatusIdle      = "idle"
	detectorStatusExited    = "exited"
)

func detectorStatus(state detector.AgentState) (string, bool) {
	switch state {
	case detector.StateExecuting:
		return detectorStatusExecuting, true
	case detector.StateWaiting:
		return detectorStatusWaiting, true
	case detector.StateNotRunning:
		return detectorStatusIdle, true
	default:
		return "", false
	}
}
