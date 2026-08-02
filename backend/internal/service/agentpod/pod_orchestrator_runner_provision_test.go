package agentpod

import (
	"context"
	"testing"

	runnerDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/runner"
	runnersvc "github.com/l8ai-cn/agentcloud/backend/internal/service/runner"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingRunnerEnsurer struct {
	calls int
	err   error
}

func (ensurer *recordingRunnerEnsurer) Ensure(
	context.Context, int64, int64, string,
) error {
	ensurer.calls++
	return ensurer.err
}

type provisionThenOnlineSelector struct {
	ensurer *recordingRunnerEnsurer
	runner  *runnerDomain.Runner
	calls   int
}

func (selector *provisionThenOnlineSelector) SelectRunnerWithAffinity(
	context.Context, int64, int64, string, *runnerDomain.AffinityHints, map[int64]int,
) (*runnerDomain.Runner, error) {
	selector.calls++
	if selector.ensurer.calls == 0 {
		return nil, runnersvc.ErrNoRunnerForAgent
	}
	return selector.runner, nil
}

func (selector *provisionThenOnlineSelector) ResolveRunnerForCreate(
	context.Context, int64, int64, int64, string, bool,
) (*runnerDomain.Runner, error) {
	return nil, runnersvc.ErrNoRunnerForAgent
}

func TestResolveRunnerForFreshCreateProvisionsWhenMissing(t *testing.T) {
	ensurer := &recordingRunnerEnsurer{}
	selector := &provisionThenOnlineSelector{
		ensurer: ensurer,
		runner:  &runnerDomain.Runner{ID: 42, ClusterID: 7},
	}
	orchestrator := NewPodOrchestrator(&PodOrchestratorDeps{
		RunnerSelector: selector,
		AgentResolver:  &mockAgentResolver{},
	})
	orchestrator.SetRunnerEnsurer(ensurer)

	req := &OrchestrateCreatePodRequest{
		OrganizationID: 1,
		UserID:         2,
		AgentSlug:      "codex-cli",
	}
	err := orchestrator.resolveRunnerForFreshCreate(context.Background(), req)

	require.NoError(t, err)
	assert.Equal(t, 1, ensurer.calls)
	assert.Equal(t, 2, selector.calls)
	assert.Equal(t, int64(42), req.RunnerID)
	assert.Equal(t, int64(7), req.clusterID)
}

func TestResolveRunnerForFreshCreateSkipsEnsureWhenOnline(t *testing.T) {
	runner := &runnerDomain.Runner{ID: 9, ClusterID: 1}
	selector := &mockRunnerSelector{runner: runner}
	ensurer := &recordingRunnerEnsurer{}
	orchestrator := NewPodOrchestrator(&PodOrchestratorDeps{
		RunnerSelector: selector,
		AgentResolver:  &mockAgentResolver{},
	})
	orchestrator.SetRunnerEnsurer(ensurer)

	req := &OrchestrateCreatePodRequest{
		OrganizationID: 1,
		UserID:         2,
		AgentSlug:      "codex-cli",
	}
	err := orchestrator.resolveRunnerForFreshCreate(context.Background(), req)

	require.NoError(t, err)
	assert.Zero(t, ensurer.calls)
	assert.Equal(t, int64(9), req.RunnerID)
}
