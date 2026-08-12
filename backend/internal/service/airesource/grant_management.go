package airesource

import (
	"context"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
)

func (s *Service) AuthorizeConnectionGrantManagement(ctx context.Context, userID, orgID, connectionID int64) error {
	connection, canManage, err := s.connectionForActor(ctx, Actor{UserID: userID}, connectionID, true)
	if err != nil {
		return err
	}
	if connection.OwnerScope != domain.OwnerScopeOrg || connection.OwnerID != orgID || !canManage {
		return ErrForbidden
	}
	return nil
}
