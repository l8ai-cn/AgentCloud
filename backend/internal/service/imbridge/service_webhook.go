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

// markError latches the connection off. Callers must be sure the failure is
// permanent: inbound and outbound both refuse a non-active connection and only
// an operator can re-enable it.
func (s *Service) markError(ctx context.Context, conn *domain.Connection, msg string) {
	stored := truncateForStorage(msg)
	conn.Status = domain.StatusError
	conn.LastError = &stored
	_ = s.repo.UpdateConnection(ctx, conn)
}

// noteFailure records a failure and latches the connection only when the
// platform rejected us permanently (revoked credentials, deleted app). A network
// blip or a forged webhook must never take the connection down.
func (s *Service) noteFailure(ctx context.Context, conn *domain.Connection, err error) {
	if err == nil {
		return
	}
	if isPermanentError(err) {
		s.markError(ctx, conn, err.Error())
		return
	}
	stored := truncateForStorage(err.Error())
	conn.LastError = &stored
	_ = s.repo.UpdateConnection(ctx, conn)
}
