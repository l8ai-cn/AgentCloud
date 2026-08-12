package grantconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/api/connect/interceptors"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	grantv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/grant/v1"
)

func (s *Server) ListGrants(
	ctx context.Context, req *connect.Request[grantv1.ListGrantsRequest],
) (*connect.Response[grantv1.ListGrantsResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}

	resourceType := req.Msg.GetResourceType()
	resourceID := req.Msg.GetResourceId()
	if !isValidResourceType(resourceType) {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("resource_type must be pod / runner / repository / model_connection / knowledge_base"))
	}
	if resourceID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("resource_id is required"))
	}

	if err := s.authorizeAccess(ctx, resourceType, resourceID, policyActionRead); err != nil {
		return nil, err
	}

	grants, err := s.grantSvc.ListGrants(ctx, resourceType, resourceID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	items := make([]*grantv1.ResourceGrant, 0, len(grants))
	for _, g := range grants {
		items = append(items, toProtoGrant(g))
	}
	return connect.NewResponse(&grantv1.ListGrantsResponse{
		Items:  items,
		Total:  int64(len(items)),
		Limit:  int32(len(items)),
		Offset: 0,
	}), nil
}

func (s *Server) CreateGrant(
	ctx context.Context, req *connect.Request[grantv1.CreateGrantRequest],
) (*connect.Response[grantv1.ResourceGrant], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)

	resourceType := req.Msg.GetResourceType()
	resourceID := req.Msg.GetResourceId()
	if !isValidResourceType(resourceType) {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("resource_type must be pod / runner / repository / model_connection / knowledge_base"))
	}
	if resourceID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("resource_id is required"))
	}
	if req.Msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("user_id is required"))
	}

	if err := s.authorizeAccess(ctx, resourceType, resourceID, policyActionWrite); err != nil {
		return nil, err
	}

	g, err := s.grantSvc.GrantAccess(
		ctx, tenant.OrganizationID, resourceType, resourceID,
		req.Msg.GetUserId(), tenant.UserID,
	)
	if err != nil {
		return nil, mapGrantError(err)
	}
	return connect.NewResponse(toProtoGrant(g)), nil
}

func (s *Server) DeleteGrant(
	ctx context.Context, req *connect.Request[grantv1.DeleteGrantRequest],
) (*connect.Response[grantv1.DeleteGrantResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}

	resourceType := req.Msg.GetResourceType()
	resourceID := req.Msg.GetResourceId()
	if !isValidResourceType(resourceType) {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("resource_type must be pod / runner / repository / model_connection / knowledge_base"))
	}
	if resourceID == "" || req.Msg.GetGrantId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("resource_id and grant_id are required"))
	}

	if err := s.authorizeAccess(ctx, resourceType, resourceID, policyActionWrite); err != nil {
		return nil, err
	}

	if err := s.grantSvc.RevokeAccess(ctx, resourceType, resourceID, req.Msg.GetGrantId()); err != nil {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("grant not found"))
	}
	return connect.NewResponse(&grantv1.DeleteGrantResponse{Message: "Grant revoked"}), nil
}
