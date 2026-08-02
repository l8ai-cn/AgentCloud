package workercreation

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubRunnerAvailability struct {
	available bool
	err       error
	calls     int
}

func (stub *stubRunnerAvailability) HasAvailableRunnerForAgent(
	context.Context, int64, int64, string,
) (bool, error) {
	stub.calls++
	return stub.available, stub.err
}

func TestWithRunnerProvisionFallsBackToProvisionChecker(t *testing.T) {
	online := &stubRunnerAvailability{}
	resolver := WithRunnerProvision(online, staticRunnerProvisionChecker{
		"codex-cli": {},
	})

	available, err := resolver.HasAvailableRunnerForAgent(
		context.Background(), 1, 2, "codex-cli",
	)
	require.NoError(t, err)
	assert.True(t, available)
	assert.Equal(t, 1, online.calls)

	available, err = resolver.HasAvailableRunnerForAgent(
		context.Background(), 1, 2, "gemini-cli",
	)
	require.NoError(t, err)
	assert.False(t, available)
}

func TestProvisionableAgentsFromEnv(t *testing.T) {
	t.Setenv(
		"COORDINATOR_RUNNER_DOCKER_COMPOSE_SERVICES",
		"codex-cli=runner-codex-cli,e2e-echo=runner-e2e-echo",
	)
	t.Setenv("COORDINATOR_RUNNER_IMAGES", "")

	checker := ProvisionableAgentsFromEnv()
	require.NotNil(t, checker)
	assert.True(t, checker.CanProvisionRunnerForAgent("codex-cli"))
	assert.True(t, checker.CanProvisionRunnerForAgent("e2e-echo"))
	assert.False(t, checker.CanProvisionRunnerForAgent("missing"))
}
