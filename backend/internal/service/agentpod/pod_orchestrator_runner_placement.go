package agentpod

import (
	"context"
	"errors"
	"log/slog"

	runnerDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/runner"
)

// RunnerEnsurerForOrchestrator provisions a Runner when none is online yet
// (coordinator launcher mode). Optional — nil means create requires an
// already-online Runner.
type RunnerEnsurerForOrchestrator interface {
	Ensure(ctx context.Context, orgID, userID int64, agentSlug string) error
}

func (o *PodOrchestrator) SetRunnerEnsurer(ensurer RunnerEnsurerForOrchestrator) {
	if o == nil {
		return
	}
	o.runnerEnsurer = ensurer
}

func (o *PodOrchestrator) resolveRunnerForFreshCreate(ctx context.Context, req *OrchestrateCreatePodRequest) error {
	if req.RunnerID != 0 {
		return o.resolveExplicitRunner(ctx, req)
	}
	if o.runnerSelector == nil || o.agentResolver == nil {
		return ErrMissingRunnerID
	}

	selectedRunner, err := o.selectRunnerWithOptionalProvision(ctx, req)
	if err != nil {
		slog.WarnContext(ctx, "runner auto-selection failed",
			"org_id", req.OrganizationID, "agent_slug", req.AgentSlug, "error", err)
		return ErrNoAvailableRunner
	}
	req.RunnerID = selectedRunner.ID
	req.clusterID = selectedRunner.ClusterID
	slog.InfoContext(ctx, "runner auto-selected",
		"runner_id", selectedRunner.ID, "org_id", req.OrganizationID, "agent_slug", req.AgentSlug)
	return nil
}

func (o *PodOrchestrator) selectRunnerWithOptionalProvision(
	ctx context.Context,
	req *OrchestrateCreatePodRequest,
) (*runnerDomain.Runner, error) {
	hints := o.buildAffinityHints(req)
	repoHistory := o.fetchRepoHistory(ctx, req.OrganizationID, hints)
	selected, err := o.runnerSelector.SelectRunnerWithAffinity(
		ctx, req.OrganizationID, req.UserID, req.AgentSlug, hints, repoHistory,
	)
	if err == nil {
		return selected, nil
	}
	if o.runnerEnsurer == nil || !errors.Is(err, runnerDomain.ErrNoRunnerForAgent) {
		return nil, err
	}
	if ensureErr := o.runnerEnsurer.Ensure(
		ctx, req.OrganizationID, req.UserID, req.AgentSlug,
	); ensureErr != nil {
		return nil, ensureErr
	}
	return o.runnerSelector.SelectRunnerWithAffinity(
		ctx, req.OrganizationID, req.UserID, req.AgentSlug, hints, repoHistory,
	)
}

func (o *PodOrchestrator) resolveExplicitRunner(ctx context.Context, req *OrchestrateCreatePodRequest) error {
	if o.runnerSelector == nil {
		return ErrNoAvailableRunner
	}
	selectedRunner, err := o.runnerSelector.ResolveRunnerForCreate(
		ctx, req.RunnerID, req.OrganizationID, req.UserID, req.AgentSlug, req.QueueIfUnavailable,
	)
	if err != nil {
		slog.WarnContext(ctx, "explicit runner eligibility failed",
			"runner_id", req.RunnerID, "org_id", req.OrganizationID,
			"agent_slug", req.AgentSlug, "error", err)
		return ErrNoAvailableRunner
	}
	req.clusterID = selectedRunner.ClusterID
	return nil
}
