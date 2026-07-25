package imbridge

import (
	"context"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (s *Service) persistWeixinConfig(ctx context.Context, conn *domain.Connection, patch weixinBridgeConfig) error {
	plain, err := s.providerConfig(conn)
	if err != nil {
		return err
	}
	merged, err := mergeWeixinConfig(plain, patch)
	if err != nil {
		return err
	}
	stored, encrypted, err := s.cipher.seal(merged)
	if err != nil {
		return err
	}
	conn.Config = stored
	conn.ConfigEncrypted = encrypted
	return s.repo.UpdateConnection(ctx, conn)
}
