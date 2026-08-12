package entitlementconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
)

func requireOrgAdmin(ctx context.Context) (*middleware.TenantContext, error) {
	tenant := middleware.GetTenant(ctx)
	if tenant == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("authentication required"))
	}
	sub := policy.NewSubject(tenant.OrganizationID, tenant.UserID, tenant.UserRole)
	if !policy.AllowAdmin(sub, tenant.OrganizationID) {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("organization admin role required"))
	}
	return tenant, nil
}

// requireOrgAdmitted keeps org admins inside the catalog the platform opened
// for them: subdividing a resource the organization itself cannot use would
// create records that silently never take effect.
//
// The probe runs as a member with no user-level rows (user id 0, empty role),
// so only the org-level verdicts matter — DenyNotGranted just means the
// resource is already narrowed to an allow-list, which is exactly what this
// surface manages.
func (s *Server) requireOrgAdmitted(ctx context.Context, kind, key string, orgID int64) error {
	decision, err := s.svc.Decide(ctx, kind, key, orgID, 0, "")
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}
	switch decision.Reason {
	case entitlementdom.DenyPlatformRevoked, entitlementdom.DenyNotEntitled:
		return connect.NewError(connect.CodePermissionDenied,
			errors.New("organization is not entitled to this resource"))
	default:
		return nil
	}
}

// memberEntitlement resolves an entitlement id inside the caller's own
// organization and refuses org-level rows, which only the platform admin
// surface may touch.
func (s *Server) memberEntitlement(
	ctx context.Context, orgID, id int64,
) (*entitlementdom.Entitlement, error) {
	rows, err := s.svc.ListForOrg(ctx, orgID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	for i := range rows {
		if rows[i].ID != id {
			continue
		}
		if rows[i].SubjectKind != entitlementdom.SubjectUser {
			return nil, connect.NewError(connect.CodePermissionDenied,
				errors.New("platform-level entitlements are managed by system administrators"))
		}
		return &rows[i], nil
	}
	return nil, connect.NewError(connect.CodeNotFound, errors.New("entitlement not found"))
}
