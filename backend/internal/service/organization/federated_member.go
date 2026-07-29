package organization

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	orgDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
)

// SyncFederatedMember ensures membership and projects the IdP's role onto it.
// The IdP is authoritative for in-org roles, so the asserted role always wins —
// including demotions. Callers must resolve the floor role themselves; an empty
// role would mean "no opinion", which this authority model does not have.
func (s *Service) SyncFederatedMember(ctx context.Context, orgID, userID int64, role string) error {
	if orgID <= 0 || userID <= 0 {
		return fmt.Errorf("organization and user are required")
	}
	role = strings.TrimSpace(role)
	if role == "" {
		return fmt.Errorf("federated member role is required")
	}
	if _, err := s.repo.GetByID(ctx, orgID); err != nil {
		return fmt.Errorf("organization %d not found: %w", orgID, err)
	}

	member, err := s.repo.GetMember(ctx, orgID, userID)
	if err != nil {
		if err == orgDomain.ErrMemberNotFound {
			if addErr := s.AddMember(ctx, orgID, userID, role); addErr != nil {
				if exists, checkErr := s.repo.MemberExists(ctx, orgID, userID); checkErr == nil && exists {
					return s.repo.UpdateMemberRole(ctx, orgID, userID, role)
				}
				return addErr
			}
			slog.InfoContext(ctx, "federated member provisioned",
				"org_id", orgID, "user_id", userID, "role", role)
			return nil
		}
		return err
	}
	if member.Role == role {
		return nil
	}
	if err := s.repo.UpdateMemberRole(ctx, orgID, userID, role); err != nil {
		return err
	}
	slog.InfoContext(ctx, "federated member role synced from IdP",
		"org_id", orgID, "user_id", userID, "from", member.Role, "to", role)
	return nil
}

// ResolveAmpTenant returns the org bound to an AMP tenant code.
func (s *Service) ResolveAmpTenant(ctx context.Context, ampTenantID string) (int64, error) {
	tenantID := strings.TrimSpace(ampTenantID)
	if tenantID == "" {
		return 0, orgDomain.ErrNotFound
	}
	org, err := s.repo.GetByAmpTenantID(ctx, tenantID)
	if err != nil {
		return 0, err
	}
	return org.ID, nil
}
