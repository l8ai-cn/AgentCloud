package extension

import (
	"context"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
)

func (s *Service) ListMyInstalledSkills(ctx context.Context, orgID, userID int64) ([]*extension.UserInstalledSkill, error) {
	return s.repo.ListUserInstalledSkills(ctx, orgID, userID)
}

func (s *Service) ListMyInstalledMcpServers(ctx context.Context, orgID, userID int64) ([]*extension.UserInstalledMcpServer, error) {
	return s.repo.ListUserInstalledMcpServers(ctx, orgID, userID)
}
