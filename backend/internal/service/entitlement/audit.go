package entitlement

import (
	"context"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/admin"
	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
)

type PlatformAuditor interface {
	LogActionFromContext(
		ctx context.Context,
		adminUserID int64,
		action admin.AuditAction,
		targetType admin.TargetType,
		targetID int64,
		oldData, newData interface{},
		ipAddress, userAgent string,
	) error
}

type OrgAuditor interface {
	LogAction(action middleware.AuditAction, opts *middleware.LogActionOptions) error
}

func (s *Service) auditGrant(ctx context.Context, row *entitlementdom.Entitlement, req GrantRequest) {
	if row.SubjectKind == entitlementdom.SubjectOrg {
		s.auditPlatform(ctx, req.GrantedBy, admin.AuditActionEntitlementGrant, row, req.IPAddress, req.UserAgent)
		return
	}
	s.auditOrg(middleware.AuditEntitlementGranted, row, req.GrantedBy, req.IPAddress, req.UserAgent)
}

func (s *Service) auditRevoke(
	ctx context.Context,
	row *entitlementdom.Entitlement,
	actorUserID int64,
	ip, userAgent string,
) {
	if row.SubjectKind == entitlementdom.SubjectOrg {
		s.auditPlatform(ctx, actorUserID, admin.AuditActionEntitlementRevoke, row, ip, userAgent)
		return
	}
	s.auditOrg(middleware.AuditEntitlementRevoked, row, actorUserID, ip, userAgent)
}

func (s *Service) auditPlatform(
	ctx context.Context,
	adminUserID int64,
	action admin.AuditAction,
	row *entitlementdom.Entitlement,
	ip, userAgent string,
) {
	if s.platformAudit == nil {
		return
	}
	_ = s.platformAudit.LogActionFromContext(
		ctx, adminUserID, action, admin.TargetTypeEntitlement, row.ID,
		nil, row, ip, userAgent,
	)
}

func (s *Service) auditOrg(
	action middleware.AuditAction,
	row *entitlementdom.Entitlement,
	actorUserID int64,
	ip, userAgent string,
) {
	if s.orgAudit == nil {
		return
	}
	_ = s.orgAudit.LogAction(action, &middleware.LogActionOptions{
		OrganizationID: row.OrganizationID,
		ActorID:        actorUserID,
		ActorType:      "user",
		ResourceType:   "entitlement",
		ResourceID:     row.ID,
		StatusCode:     200,
		Details: map[string]interface{}{
			"resource_kind": row.ResourceKind,
			"resource_key":  row.ResourceKey,
			"effect":        row.Effect,
		},
		IPAddress: ip,
		UserAgent: userAgent,
	})
}
