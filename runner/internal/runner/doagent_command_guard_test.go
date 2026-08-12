package runner

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
)

func TestIsDetachedDoAgentCommand(t *testing.T) {
	tests := []struct {
		name  string
		agent string
		args  string
		want  bool
	}{
		{"nohup", "do-agent", `{"command":"nohup python analysis.py > run.log 2>&1 &"}`, true},
		{"ampersand", "do-agent", `{"script":"python analysis.py &"}`, true},
		{"foreground", "do-agent", `{"command":"python analysis.py"}`, false},
		{"logical and", "do-agent", `{"command":"mkdir -p out && python analysis.py"}`, false},
		{"quoted ampersand", "do-agent", `{"command":"printf '%s' 'a&b'"}`, false},
		{"non doagent", "codex", `{"command":"nohup python analysis.py &"}`, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isDetachedDoAgentCommand(tt.agent, acp.PermissionRequest{ArgumentsJSON: tt.args})
			if got != tt.want {
				t.Fatalf("isDetachedDoAgentCommand() = %v, want %v", got, tt.want)
			}
		})
	}
}
