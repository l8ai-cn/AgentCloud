package runner

import (
	"os"
	"path/filepath"
	"testing"

	agentworkbenchv2 "github.com/l8ai-cn/agentcloud/proto/gen/go/agent_workbench/v2"
	"github.com/l8ai-cn/agentcloud/runner/internal/client"
	"github.com/l8ai-cn/agentcloud/runner/internal/terminal/detector"
	"github.com/stretchr/testify/require"
)

func TestWirePTYWorkbenchPublishesTerminalSessionAndInitialPrompt(t *testing.T) {
	connection := client.NewMockConnection()
	pod := &Pod{PodKey: "pod-1", Agent: "codex-cli", WorkDir: t.TempDir()}

	wirePTYWorkbench(pod, "跑一下测试", connection, "", pod.Agent, "codex")

	require.NotNil(t, pod.workbenchForwarder)
	raw := rawWorkbenchMessages(t, connection.GetEvents())
	require.Len(t, raw, 2)
	session := raw[0].GetWorkbenchEvents()
	require.Equal(t, "codex-cli", session.GetAdapterId())
	require.NotNil(t, session.GetMutations()[0].GetCapabilities())
	require.Equal(
		t,
		"main",
		session.GetMutations()[1].GetResource().GetResourceId(),
	)
	prompt := raw[1].GetWorkbenchEvents().GetMutations()[0].GetTimeline()
	require.Equal(
		t,
		agentworkbenchv2.MessageRole_MESSAGE_ROLE_USER,
		prompt.GetContent().GetMessage().GetRole(),
	)
}

func TestWirePTYWorkbenchSkipsPromptWhenPodStartsWithout(t *testing.T) {
	connection := client.NewMockConnection()
	pod := &Pod{PodKey: "pod-1", Agent: "codex-cli", WorkDir: t.TempDir()}

	wirePTYWorkbench(pod, "", connection, pod.Agent)

	require.Len(t, rawWorkbenchMessages(t, connection.GetEvents()), 1)
}

func TestPTYWorkbenchForwarderScansArtifactsWhenAgentAcceptsInput(t *testing.T) {
	root := t.TempDir()
	connection := client.NewMockConnection()
	forwarder, err := newPodWorkbenchForwarder(
		"pod-1",
		"codex-cli",
		root,
		connection,
	)
	require.NoError(t, err)
	output := filepath.Join(root, "output", "demo.mp4")
	require.NoError(t, os.MkdirAll(filepath.Dir(output), 0o755))
	require.NoError(t, os.WriteFile(output, []byte("video"), 0o644))

	forwarder.terminalState(detectorStatusWaiting)

	raw := rawWorkbenchMessages(t, connection.GetEvents())
	require.Len(t, raw, 2)
	require.Equal(
		t,
		agentworkbenchv2.SessionStatus_SESSION_STATUS_IDLE,
		raw[0].GetWorkbenchEvents().GetMutations()[0].GetStatus().GetStatus(),
	)
	require.Equal(
		t,
		"workspace:output/demo.mp4",
		raw[1].GetWorkbenchEvents().GetMutations()[0].GetArtifact().GetArtifactId(),
	)
}

func TestPTYWorkbenchForwarderKeepsExecutingTurnsOutOfArtifactScan(t *testing.T) {
	connection := client.NewMockConnection()
	forwarder, err := newPodWorkbenchForwarder(
		"pod-1",
		"codex-cli",
		t.TempDir(),
		connection,
	)
	require.NoError(t, err)

	forwarder.terminalState(detectorStatusExecuting)

	raw := rawWorkbenchMessages(t, connection.GetEvents())
	require.Len(t, raw, 1)
	require.Equal(
		t,
		agentworkbenchv2.SessionStatus_SESSION_STATUS_RUNNING,
		raw[0].GetWorkbenchEvents().GetMutations()[0].GetStatus().GetStatus(),
	)
}

func TestDetectorStatusMapsOnlyKnownAgentStates(t *testing.T) {
	for state, want := range map[detector.AgentState]string{
		detector.StateExecuting:  detectorStatusExecuting,
		detector.StateWaiting:    detectorStatusWaiting,
		detector.StateNotRunning: detectorStatusIdle,
	} {
		status, ok := detectorStatus(state)
		require.True(t, ok)
		require.Equal(t, want, status)
	}
	_, ok := detectorStatus(detector.AgentState("dreaming"))
	require.False(t, ok)
}
