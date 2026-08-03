package runner

import (
	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
	"github.com/l8ai-cn/agentcloud/runner/internal/client"
)

func newACPWorkbenchForwarder(
	podKey, adapterID, workDir string,
	sender client.ConnectionSender,
) (*podWorkbenchForwarder, error) {
	return newPodWorkbenchForwarder(podKey, adapterID, workDir, sender)
}

func (f *podWorkbenchForwarder) content(sessionID string, chunk acp.ContentChunk) {
	f.send(f.mapper.ContentChunk(sessionID, chunk))
}

func (f *podWorkbenchForwarder) toolUpdate(
	sessionID string,
	update acp.ToolCallUpdate,
) {
	f.send(f.mapper.ToolUpdate(sessionID, update))
}

func (f *podWorkbenchForwarder) toolResult(
	sessionID string,
	result acp.ToolCallResult,
) {
	f.send(f.mapper.ToolResult(sessionID, result))
}

func (f *podWorkbenchForwarder) plan(sessionID string, update acp.PlanUpdate) {
	f.send(f.mapper.Plan(sessionID, update))
}

func (f *podWorkbenchForwarder) thinking(
	sessionID string,
	update acp.ThinkingUpdate,
) {
	f.send(f.mapper.Thinking(sessionID, update))
}

func (f *podWorkbenchForwarder) permission(request acp.PermissionRequest) {
	f.send(f.mapper.Permission(request))
}

func (f *podWorkbenchForwarder) sessionInitialized(configuration acp.Configuration) {
	f.send(f.mapper.SessionInitialized(configuration))
}

func (f *podWorkbenchForwarder) configurationChanged(update acp.ConfigUpdate) {
	f.send(f.mapper.ConfigurationChanged(update))
}

func (f *podWorkbenchForwarder) state(state string) {
	f.send(f.mapper.State(state))
	if state != acp.StateIdle {
		return
	}
	f.scanArtifacts()
}

func (f *podWorkbenchForwarder) sessionID(sessionID string) {
	f.mapper.SetExternalSessionID(sessionID)
}
