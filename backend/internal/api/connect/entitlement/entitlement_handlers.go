package entitlementconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/api/connect/interceptors"
	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
	entitlementv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/entitlement/v1"
)

// memberEntitlementRequest unifies the Grant/Deny request messages, which
// carry identical fields and differ only in the effect they write.
type memberEntitlementRequest interface {
	interceptors.OrgScopedRequest
	GetResourceKind() string
	GetResourceKey() string
	GetUserId() int64
	GetReason() string
	GetExpiresAt() string
}

func (s *Server) ListEntitlements(
	ctx context.Context, req *connect.Request[entitlementv1.ListEntitlementsRequest],
) (*connect.Response[entitlementv1.ListEntitlementsResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	tenant, err := requireOrgAdmin(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := s.svc.ListForOrg(ctx, tenant.OrganizationID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	items := ToProtoEntitlements(rows, req.Msg.GetResourceKind())
	return connect.NewResponse(&entitlementv1.ListEntitlementsResponse{
		Items: items,
		Total: int64(len(items)),
		Limit: int32(len(items)),
	}), nil
}

func (s *Server) GrantMemberEntitlement(
	ctx context.Context, req *connect.Request[entitlementv1.GrantMemberEntitlementRequest],
) (*connect.Response[entitlementv1.Entitlement], error) {
	return s.writeMemberEntitlement(
		ctx, req.Msg, entitlementdom.EffectAllow,
		req.Peer().Addr, req.Header().Get("User-Agent"),
	)
}

func (s *Server) DenyMemberEntitlement(
	ctx context.Context, req *connect.Request[entitlementv1.DenyMemberEntitlementRequest],
) (*connect.Response[entitlementv1.Entitlement], error) {
	return s.writeMemberEntitlement(
		ctx, req.Msg, entitlementdom.EffectDeny,
		req.Peer().Addr, req.Header().Get("User-Agent"),
	)
}

func (s *Server) DeleteMemberEntitlement(
	ctx context.Context, req *connect.Request[entitlementv1.DeleteMemberEntitlementRequest],
) (*connect.Response[entitlementv1.DeleteMemberEntitlementResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	tenant, err := requireOrgAdmin(ctx)
	if err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	if _, err := s.memberEntitlement(ctx, tenant.OrganizationID, req.Msg.GetId()); err != nil {
		return nil, err
	}
	if err := s.svc.Revoke(
		ctx, req.Msg.GetId(), tenant.UserID,
		req.Peer().Addr, req.Header().Get("User-Agent"),
	); err != nil {
		return nil, MapServiceError(err)
	}
	return connect.NewResponse(&entitlementv1.DeleteMemberEntitlementResponse{
		Message: "Entitlement revoked",
	}), nil
}

func (s *Server) writeMemberEntitlement(
	ctx context.Context, msg memberEntitlementRequest, effect, ipAddr, userAgent string,
) (*connect.Response[entitlementv1.Entitlement], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	tenant, err := requireOrgAdmin(ctx)
	if err != nil {
		return nil, err
	}
	if msg.GetUserId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("user_id is required"))
	}
	expiresAt, err := ParseExpiry(msg.GetExpiresAt())
	if err != nil {
		return nil, err
	}
	if err := s.requireOrgAdmitted(
		ctx, msg.GetResourceKind(), msg.GetResourceKey(), tenant.OrganizationID,
	); err != nil {
		return nil, err
	}
	userID := msg.GetUserId()
	row, err := s.svc.Grant(ctx, entitlementsvc.GrantRequest{
		Kind:           msg.GetResourceKind(),
		Key:            msg.GetResourceKey(),
		OrganizationID: tenant.OrganizationID,
		SubjectKind:    entitlementdom.SubjectUser,
		SubjectUserID:  &userID,
		Effect:         effect,
		Reason:         msg.GetReason(),
		ExpiresAt:      expiresAt,
		GrantedBy:      tenant.UserID,
		IPAddress:      ipAddr,
		UserAgent:      userAgent,
	})
	if err != nil {
		return nil, MapServiceError(err)
	}
	return connect.NewResponse(ToProtoEntitlement(row)), nil
}
