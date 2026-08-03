package podconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/api/connect/interceptors"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/workerskill"
	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
	podv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/pod/v1"
)

type SkillRemounter interface {
	Remount(context.Context, workerskill.Request) (workerskill.Result, error)
}

// UpdatePodSkills rewrites which skill packages a worker mounts. Skills are
// pinned by content SHA at creation, so this writes a new spec snapshot and
// repoints the pod instead of mutating history.
func (s *Server) UpdatePodSkills(
	ctx context.Context, req *connect.Request[podv1.UpdatePodSkillsRequest],
) (*connect.Response[podv1.UpdatePodSkillsResponse], error) {
	if s.skillRemounter == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("skill remounter not configured"))
	}
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)
	podKey := req.Msg.GetPodKey()

	pod, err := s.podSvc.GetPod(ctx, podKey)
	if err != nil {
		return nil, mapServiceError(err)
	}
	sub := policy.NewSubject(tenant.OrganizationID, tenant.UserID, tenant.UserRole)
	if !policy.PodPolicy.AllowWrite(sub, s.podResourceWithGrants(ctx, podKey, pod.OrganizationID, pod.CreatedByID)) {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("forbidden"))
	}
	if pod.WorkerSpecSnapshotID == nil {
		return nil, connect.NewError(
			connect.CodeFailedPrecondition,
			errors.New("worker was not created from a spec snapshot"),
		)
	}

	result, err := s.skillRemounter.Remount(ctx, workerskill.Request{
		OrganizationID: pod.OrganizationID,
		PodKey:         podKey,
		RunnerID:       pod.RunnerID,
		SnapshotID:     *pod.WorkerSpecSnapshotID,
		SkillIDs:       req.Msg.GetSkillIds(),
		RunnerLive:     pod.IsActive(),
	})
	if err != nil {
		return nil, mapRemountError(err)
	}
	return connect.NewResponse(&podv1.UpdatePodSkillsResponse{
		MountedSlugs:    result.MountedSlugs,
		AddedSlugs:      result.AddedSlugs,
		RemovedSlugs:    result.RemovedSlugs,
		AppliedToRunner: result.AppliedToRunner,
	}), nil
}

func mapRemountError(err error) error {
	switch {
	case errors.Is(err, workerskill.ErrInvalidSkillSelection):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, workerskill.ErrSnapshotMissing):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, workerskill.ErrDependencyUnavailable):
		return connect.NewError(connect.CodeUnavailable, err)
	default:
		return mapServiceError(err)
	}
}
