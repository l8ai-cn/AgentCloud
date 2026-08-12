package grantconnect

import (
	"context"
	"errors"
	"strconv"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
)

type policyAction int

const (
	policyActionRead  policyAction = 0
	policyActionWrite policyAction = 1
)

func isValidResourceType(t string) bool {
	switch t {
	case grant.TypePod, grant.TypeRunner, grant.TypeRepository, grant.TypeModelConnection, grant.TypeKnowledgeBase:
		return true
	}
	return false
}

func (s *Server) authorizeAccess(
	ctx context.Context, resourceType, resourceID string, action policyAction,
) error {
	tenant := middleware.GetTenant(ctx)
	sub := policy.NewSubject(tenant.OrganizationID, tenant.UserID, tenant.UserRole)

	switch resourceType {
	case grant.TypePod:
		return s.authorizePodAccess(ctx, sub, resourceID)
	case grant.TypeRunner:
		return s.authorizeRunnerAccess(ctx, sub, tenant, resourceID, action)
	case grant.TypeRepository:
		return s.authorizeRepositoryAccess(ctx, sub, tenant, resourceID, action)
	case grant.TypeModelConnection:
		return s.authorizeModelConnectionAccess(ctx, tenant, resourceID)
	case grant.TypeKnowledgeBase:
		return s.authorizeKnowledgeBaseAccess(ctx, sub, tenant.OrganizationID, resourceID)
	}
	return nil
}

func (s *Server) authorizePodAccess(ctx context.Context, sub policy.Subject, resourceID string) error {
	pod, err := s.podSvc.GetPod(ctx, resourceID)
	if err != nil {
		return connect.NewError(connect.CodeNotFound, errors.New("pod not found"))
	}
	rc := policy.PodResource(pod.OrganizationID, pod.CreatedByID)
	if !policy.PodPolicy.AllowWrite(sub, rc) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("forbidden"))
	}
	return nil
}

func (s *Server) authorizeRunnerAccess(
	ctx context.Context, sub policy.Subject, tenant *middleware.TenantContext, resourceID string, action policyAction,
) error {
	runnerID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("invalid runner id"))
	}
	r, err := s.runnerSvc.GetRunner(ctx, runnerID)
	if err != nil {
		return connect.NewError(connect.CodeNotFound, errors.New("runner not found"))
	}
	if !policy.AllowAdmin(sub, tenant.OrganizationID) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("organization admin role required"))
	}
	check := policy.RunnerPolicy.AllowRead
	if action == policyActionWrite {
		check = policy.RunnerPolicy.AllowWrite
	}
	if !check(sub, policy.VisibleResource(r.OrganizationID, r.RegisteredByUserID, r.Visibility)) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("forbidden"))
	}
	return nil
}

func (s *Server) authorizeRepositoryAccess(
	ctx context.Context, sub policy.Subject, tenant *middleware.TenantContext, resourceID string, action policyAction,
) error {
	repoID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("invalid repository id"))
	}
	repo, err := s.repoSvc.GetByID(ctx, repoID)
	if err != nil {
		return connect.NewError(connect.CodeNotFound, errors.New("repository not found"))
	}
	if !policy.AllowAdmin(sub, tenant.OrganizationID) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("organization admin role required"))
	}
	check := policy.RepositoryPolicy.AllowRead
	if action == policyActionWrite {
		check = policy.RepositoryPolicy.AllowWrite
	}
	if !check(sub, policy.VisibleResource(repo.OrganizationID, repo.ImportedByUserID, repo.Visibility)) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("forbidden"))
	}
	return nil
}

func (s *Server) authorizeModelConnectionAccess(ctx context.Context, tenant *middleware.TenantContext, resourceID string) error {
	if s.modelConnSvc == nil {
		return connect.NewError(connect.CodeInternal, errors.New("model connection grant authorizer unavailable"))
	}
	connectionID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("invalid model connection id"))
	}
	if err := s.modelConnSvc.AuthorizeConnectionGrantManagement(ctx, tenant.UserID, tenant.OrganizationID, connectionID); err != nil {
		return connect.NewError(connect.CodePermissionDenied, errors.New("organization admin role required"))
	}
	return nil
}
