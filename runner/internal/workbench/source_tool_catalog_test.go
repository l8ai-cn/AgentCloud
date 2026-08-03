package workbench

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
	"github.com/stretchr/testify/require"
)

func TestResolveToolIdentity_ExactAndPrefixedBash(t *testing.T) {
	identity, category := resolveToolIdentity("acp", "Bash")
	require.Equal(t, "shell", category)
	require.Equal(t, "shell.execute", identity.GetSemanticKey())
	require.Equal(t, "Bash", identity.GetSourceToolName())

	identity, category = resolveToolIdentity(
		"acp",
		`Bash for i in {1..36}; do if [ -f "DONE.json" ]; then echo FOUND; fi; done`,
	)
	require.Equal(t, "shell", category)
	require.Equal(t, "shell.execute", identity.GetSemanticKey())
	require.Equal(t, "Bash", identity.GetSourceToolName())
}

func TestResolveToolIdentity_UnknownFallsBackToCustom(t *testing.T) {
	identity, category := resolveToolIdentity("acp", "WikiQuery")
	require.Equal(t, "custom", category)
	require.Equal(t, "tool.custom", identity.GetSemanticKey())
	require.Equal(t, "WikiQuery", identity.GetSourceToolName())
	require.Equal(t, "agentcloud.acp", identity.GetNamespace())
}

func TestResolveToolIdentity_CaseInsensitive(t *testing.T) {
	identity, category := resolveToolIdentity("codex", "bash")
	require.Equal(t, "shell", category)
	require.Equal(t, "shell.execute", identity.GetSemanticKey())
	require.Equal(t, "agentcloud.codex", identity.GetNamespace())
}

func TestToolUpdateMapsPrefixedBashTitle(t *testing.T) {
	mapper := NewMapper("pod-1", "do-agent")
	batch := mapper.ToolUpdate("", acp.ToolCallUpdate{
		ToolCallID: "call-1",
		ToolName:   `Bash for i in {1..36}; do echo hi; done`,
		Status:     "in_progress",
	})
	require.Len(t, batch.GetMutations(), 1)
	require.Nil(t, batch.GetMutations()[0].GetUnsupported())
	tool := batch.GetMutations()[0].GetTimeline().GetContent().GetToolExecution()
	require.NotNil(t, tool)
	require.Equal(t, "shell.execute", tool.GetIdentity().GetSemanticKey())
	require.Equal(t, "Bash", tool.GetIdentity().GetSourceToolName())
}
