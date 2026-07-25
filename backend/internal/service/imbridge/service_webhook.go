package imbridge

import (
	"context"
	"net/http"
	"strings"

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

func (s *Service) HandleWebhook(ctx context.Context, provider string, connectionID int64, token string, headers http.Header, body []byte) (interface{}, error) {
	conn, err := s.connectionForWebhook(ctx, provider, token, connectionID)
	if err != nil {
		return nil, err
	}
	if conn.Status != domain.StatusActive {
		return nil, ErrConnectionPaused
	}
	p, err := GetProvider(s.registry, provider)
	if err != nil {
		return nil, err
	}
	cfg, err := s.providerConfig(conn)
	if err != nil {
		return nil, err
	}
	if err := p.VerifyWebhook(ctx, cfg, headers, body); err != nil {
		s.markError(ctx, conn, err.Error())
		return nil, err
	}
	event, err := p.ParseInbound(ctx, cfg, headers, body)
	if err != nil {
		s.markError(ctx, conn, err.Error())
		return nil, err
	}
	if event.Challenge != "" {
		return map[string]string{"challenge": event.Challenge}, nil
	}
	if strings.TrimSpace(event.Text) == "" {
		return map[string]string{"status": "ignored"}, nil
	}
	return map[string]string{"status": "accepted", "thread": event.ExternalThreadID}, nil
}
