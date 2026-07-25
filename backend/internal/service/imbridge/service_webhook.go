package imbridge

import (
	"context"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (s *Service) connectionForWebhook(ctx context.Context, provider, token string, connectionID int64) (*domain.Connection, error) {
	conn, err := s.repo.GetConnectionByToken(ctx, provider, token)
	if err != nil {
		return nil, err
	}
	if conn == nil || conn.ID != connectionID {
		return nil, ErrNotFound
	}
	return conn, nil
}

func (s *Service) markError(ctx context.Context, conn *domain.Connection, msg string) {
	conn.Status = domain.StatusError
	conn.LastError = &msg
	_ = s.repo.UpdateConnection(ctx, conn)
}
