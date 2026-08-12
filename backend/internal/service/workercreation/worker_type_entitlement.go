package workercreation

import (
	"context"
	"errors"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

func (service *Service) memberRole(ctx context.Context, orgID, userID int64) string {
	if service == nil || service.memberRoles == nil || orgID <= 0 || userID <= 0 {
		return organization.RoleMember
	}
	role, err := service.memberRoles.GetMemberRole(ctx, orgID, userID)
	if err != nil || role == "" {
		return organization.RoleMember
	}
	return role
}

func (service *Service) workerTypeEntitlementSnapshot(
	ctx context.Context,
	orgID int64,
) (entitlementsvc.Snapshot, error) {
	gate := service.Entitlements()
	if gate == nil || orgID <= 0 {
		return nil, nil
	}
	return gate.SnapshotFor(ctx, orgID)
}

func decideWorkerTypeEntitlement(
	snap entitlementsvc.Snapshot,
	slug string,
	userID int64,
	role string,
) entitlementdom.Decision {
	if snap == nil {
		return entitlementdom.Allow()
	}
	return snap.Decide(entitlementdom.KindWorkerType, slug, userID, role)
}

func requireWorkerTypeEntitlement(
	ctx context.Context,
	gate *entitlementsvc.Service,
	memberRoles MemberRoleReader,
	scope specservice.Scope,
	slug string,
) error {
	if gate == nil || scope.OrgID <= 0 {
		return nil
	}
	role := memberRoleFromScope(ctx, memberRoles, scope)
	if err := gate.Require(
		ctx,
		scope.OrgID,
		scope.UserID,
		role,
		entitlementdom.KindWorkerType,
		slug,
	); err != nil {
		var denied *entitlementsvc.DeniedError
		if errors.As(err, &denied) {
			return invalidWorkerType(entitlementDeniedMessage(denied))
		}
		return err
	}
	return nil
}

func memberRoleFromScope(
	ctx context.Context,
	memberRoles MemberRoleReader,
	scope specservice.Scope,
) string {
	if memberRoles == nil || scope.OrgID <= 0 || scope.UserID <= 0 {
		return organization.RoleMember
	}
	role, err := memberRoles.GetMemberRole(ctx, scope.OrgID, scope.UserID)
	if err != nil || role == "" {
		return organization.RoleMember
	}
	return role
}

func entitlementScopeReady(scope specservice.Scope) bool {
	return scope.OrgID > 0 && scope.UserID > 0
}

func entitlementDeniedMessage(denied *entitlementsvc.DeniedError) string {
	switch denied.Reason {
	case entitlementdom.DenyNotGranted:
		return "worker type is not granted to this member"
	case entitlementdom.DenyNotEntitled:
		return "worker type is not entitled for this organization"
	case entitlementdom.DenyPlatformRevoked:
		return "worker type access was revoked by the platform"
	default:
		return "worker type is not available"
	}
}

func (service *Service) AssertWorkerTypeEntitled(
	ctx context.Context,
	orgID, userID int64,
	slug string,
) error {
	if service == nil || orgID <= 0 {
		return nil
	}
	parsed, err := slugkit.NewFromTrusted(slug)
	if err != nil {
		return invalidWorkerType("slug is invalid")
	}
	return requireWorkerTypeEntitlement(
		ctx,
		service.Entitlements(),
		service.memberRoles,
		specservice.Scope{OrgID: orgID, UserID: userID},
		parsed.String(),
	)
}

func platformEntitlementDenied(decision entitlementdom.Decision) bool {
	return !decision.Allowed &&
		(decision.Reason == entitlementdom.DenyNotEntitled ||
			decision.Reason == entitlementdom.DenyPlatformRevoked)
}
