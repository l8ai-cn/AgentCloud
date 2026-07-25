package organization

import (
	"context"
	"fmt"
	"log/slog"

	orgDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
)

// EnsureMember idempotently places a user in an organization, leaving an
// existing role untouched. Used by identity-federation login paths where the
// same user re-enters on every login.
func (s *Service) EnsureMember(ctx context.Context, orgID, userID int64, role string) error {
	if orgID <= 0 || userID <= 0 {
		return fmt.Errorf("organization and user are required")
	}
	if role == "" {
		role = orgDomain.RoleMember
	}

	exists, err := s.repo.MemberExists(ctx, orgID, userID)
	if err != nil {
		return fmt.Errorf("failed to check organization membership: %w", err)
	}
	if exists {
		return nil
	}

	if _, err := s.repo.GetByID(ctx, orgID); err != nil {
		return fmt.Errorf("organization %d not found: %w", orgID, err)
	}

	if err := s.AddMember(ctx, orgID, userID, role); err != nil {
		// A concurrent login may have won the race; the unique index on
		// (organization_id, user_id) makes that outcome equivalent to success.
		if exists, checkErr := s.repo.MemberExists(ctx, orgID, userID); checkErr == nil && exists {
			return nil
		}
		return err
	}

	slog.InfoContext(ctx, "member provisioned from external identity",
		"org_id", orgID, "user_id", userID, "role", role)
	return nil
}
