package workercreation

import (
	"context"
	"testing"

	agentdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agent"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/stretchr/testify/require"
)

func TestAssertWorkerTypeAvailableRejectsUnknownSlug(t *testing.T) {
	service := NewService(Deps{
		Catalog: enabledCodexRuntimeCatalog(),
		Definitions: staticWorkerDefinitions{
			"codex-cli": workerDefinition("codex-cli", "codex", "AGENT codex\nEXECUTABLE codex\nMODE acp\n", "pty", "acp"),
		},
		Agents: &workerOptionsAgentProvider{agents: []*agentdomain.Agent{
			activeWorkerTypeAgentFor("codex-cli", "codex", "AGENT codex\nEXECUTABLE codex\nMODE acp\n"),
		}},
	})

	err := service.AssertWorkerTypeAvailable(context.Background(), "does-not-exist")
	require.Error(t, err)
	require.ErrorIs(t, err, specservice.ErrInvalidDraft)

	require.NoError(t, service.AssertWorkerTypeAvailable(context.Background(), "codex-cli"))
}
