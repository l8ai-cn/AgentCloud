package doagent

import (
	"encoding/json"
	"testing"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
)

func TestHandlePermissionUpdatedIncludesInput(t *testing.T) {
	var got acp.PermissionRequest
	transport := newTransport(acp.EventCallbacks{
		OnPermissionRequest: func(req acp.PermissionRequest) { got = req },
	}, nil)
	transport.handlePermissionUpdated(json.RawMessage(`{
		"sessionId":"session-1",
		"permission":{"id":"permission-1","tool":"bash","input":{"command":"python analysis.py"}}
	}`))

	if got.ArgumentsJSON != `{"command":"python analysis.py"}` {
		t.Fatalf("ArgumentsJSON = %q", got.ArgumentsJSON)
	}
}
