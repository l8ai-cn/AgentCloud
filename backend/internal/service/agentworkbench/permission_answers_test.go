package agentworkbench

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizePermissionAnswers(t *testing.T) {
	input := map[string]any{
		"answers": map[string]any{
			"Which database?": []any{"PostgreSQL"},
			"Targets":         []any{"Web", "CLI"},
			"Already":         "plain",
		},
	}

	normalizePermissionAnswers(input)

	answers := input["answers"].(map[string]any)
	require.Equal(t, "PostgreSQL", answers["Which database?"])
	require.Equal(t, []string{"Web", "CLI"}, answers["Targets"])
	require.Equal(t, "plain", answers["Already"])
}
