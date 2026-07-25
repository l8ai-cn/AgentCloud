package imbridge

import (
	"context"
	"strings"
	"time"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (b *Bridge) PairWithCode(ctx context.Context, orgID, userID int64, code string) (*domain.IdentityBinding, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return nil, ErrInvalidConfig
	}
	binding, err := b.repo.GetIdentityBindingByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if binding == nil || binding.PairingExpiresAt == nil || binding.PairingExpiresAt.Before(time.Now().UTC()) {
		return nil, ErrNotFound
	}
	if _, err := b.GetConnection(ctx, orgID, binding.ConnectionID); err != nil {
		return nil, ErrNotFound
	}
	binding.UserID = &userID
	binding.Status = domain.BindingBound
	binding.PairingCode = nil
	binding.PairingExpiresAt = nil
	if err := b.repo.UpdateIdentityBinding(ctx, binding); err != nil {
		return nil, err
	}
	return binding, nil
}

func (b *Bridge) ListIdentityBindings(ctx context.Context, orgID, connectionID int64) ([]*domain.IdentityBinding, error) {
	if _, err := b.GetConnection(ctx, orgID, connectionID); err != nil {
		return nil, err
	}
	return b.repo.ListIdentityBindings(ctx, connectionID)
}
