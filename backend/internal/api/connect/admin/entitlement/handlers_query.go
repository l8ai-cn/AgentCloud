package entitlementadminconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	entitlementconnect "github.com/l8ai-cn/agentcloud/backend/internal/api/connect/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/api/connect/interceptors"
	entitlementv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/entitlement/v1"
)

func (s *Server) ListOrganizationEntitlements(
	ctx context.Context, req *connect.Request[entitlementv1.ListOrganizationEntitlementsRequest],
) (*connect.Response[entitlementv1.ListOrganizationEntitlementsResponse], error) {
	ctx, _, err := interceptors.ResolveSystemAdmin(ctx, s.db)
	if err != nil {
		return nil, err
	}
	if req.Msg.GetOrganizationId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("organization_id is required"))
	}
	rows, err := s.svc.ListForOrg(ctx, req.Msg.GetOrganizationId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	items := entitlementconnect.ToProtoEntitlements(rows, req.Msg.GetResourceKind())
	return connect.NewResponse(&entitlementv1.ListOrganizationEntitlementsResponse{
		Items: items,
		Total: int64(len(items)),
		Limit: int32(len(items)),
	}), nil
}

func (s *Server) ListResourceEntitlements(
	ctx context.Context, req *connect.Request[entitlementv1.ListResourceEntitlementsRequest],
) (*connect.Response[entitlementv1.ListResourceEntitlementsResponse], error) {
	ctx, _, err := interceptors.ResolveSystemAdmin(ctx, s.db)
	if err != nil {
		return nil, err
	}
	if req.Msg.GetResourceKind() == "" || req.Msg.GetResourceKey() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("resource_kind and resource_key are required"))
	}
	rows, err := s.svc.ListForResource(ctx, req.Msg.GetResourceKind(), req.Msg.GetResourceKey())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	items := entitlementconnect.ToProtoEntitlements(rows, "")
	return connect.NewResponse(&entitlementv1.ListResourceEntitlementsResponse{
		Items: items,
		Total: int64(len(items)),
		Limit: int32(len(items)),
	}), nil
}
