package entitlementadminconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	entitlementconnect "github.com/l8ai-cn/agentcloud/backend/internal/api/connect/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/api/connect/interceptors"
	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
	entitlementv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/entitlement/v1"
)

// entitlementWriteRequest unifies the Grant/Deny request messages, which
// carry identical fields and differ only in the effect they write.
type entitlementWriteRequest interface {
	GetResourceKind() string
	GetResourceKey() string
	GetOrganizationId() int64
	GetSubjectUserId() int64
	GetReason() string
	GetExpiresAt() string
}

func (s *Server) GrantEntitlement(
	ctx context.Context, req *connect.Request[entitlementv1.GrantEntitlementRequest],
) (*connect.Response[entitlementv1.Entitlement], error) {
	return s.write(
		ctx, req.Msg, entitlementdom.EffectAllow,
		req.Peer().Addr, req.Header().Get("User-Agent"),
	)
}

func (s *Server) DenyEntitlement(
	ctx context.Context, req *connect.Request[entitlementv1.DenyEntitlementRequest],
) (*connect.Response[entitlementv1.Entitlement], error) {
	return s.write(
		ctx, req.Msg, entitlementdom.EffectDeny,
		req.Peer().Addr, req.Header().Get("User-Agent"),
	)
}

func (s *Server) DeleteEntitlement(
	ctx context.Context, req *connect.Request[entitlementv1.DeleteEntitlementRequest],
) (*connect.Response[entitlementv1.DeleteEntitlementResponse], error) {
	ctx, admin, err := interceptors.ResolveSystemAdmin(ctx, s.db)
	if err != nil {
		return nil, err
	}
	if req.Msg.GetId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id is required"))
	}
	if err := s.svc.Revoke(
		ctx, req.Msg.GetId(), admin.ID,
		req.Peer().Addr, req.Header().Get("User-Agent"),
	); err != nil {
		return nil, entitlementconnect.MapServiceError(err)
	}
	return connect.NewResponse(&entitlementv1.DeleteEntitlementResponse{
		Message: "Entitlement revoked",
	}), nil
}

func (s *Server) write(
	ctx context.Context, msg entitlementWriteRequest, effect, ipAddr, userAgent string,
) (*connect.Response[entitlementv1.Entitlement], error) {
	ctx, admin, err := interceptors.ResolveSystemAdmin(ctx, s.db)
	if err != nil {
		return nil, err
	}
	if msg.GetOrganizationId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("organization_id is required"))
	}
	expiresAt, err := entitlementconnect.ParseExpiry(msg.GetExpiresAt())
	if err != nil {
		return nil, err
	}
	subjectKind, subjectUserID := subjectOf(msg.GetSubjectUserId())
	row, err := s.svc.Grant(ctx, entitlementsvc.GrantRequest{
		Kind:           msg.GetResourceKind(),
		Key:            msg.GetResourceKey(),
		OrganizationID: msg.GetOrganizationId(),
		SubjectKind:    subjectKind,
		SubjectUserID:  subjectUserID,
		Effect:         effect,
		Reason:         msg.GetReason(),
		ExpiresAt:      expiresAt,
		GrantedBy:      admin.ID,
		IPAddress:      ipAddr,
		UserAgent:      userAgent,
	})
	if err != nil {
		return nil, entitlementconnect.MapServiceError(err)
	}
	return connect.NewResponse(entitlementconnect.ToProtoEntitlement(row)), nil
}

func subjectOf(userID int64) (string, *int64) {
	if userID == 0 {
		return entitlementdom.SubjectOrg, nil
	}
	return entitlementdom.SubjectUser, &userID
}
