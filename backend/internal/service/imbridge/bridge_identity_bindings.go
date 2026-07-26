package imbridge

import (
	"context"
	"fmt"
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

func (b *Bridge) ListIdentityBindings(ctx context.Context, orgID, connectionID int64) ([]*domain.IdentityBindingView, error) {
	if _, err := b.GetConnection(ctx, orgID, connectionID); err != nil {
		return nil, err
	}
	return b.repo.ListIdentityBindingViews(ctx, connectionID)
}

// SetIdentityBindingStatus is the operator's kill switch for an IM identity.
// Granting is not an operator action: only the IM user can claim an identity by
// entering the pairing code, so `bound` is accepted solely to lift a block on an
// identity that was already claimed. `pending` drops the claim and forces the
// user to pair again.
func (b *Bridge) SetIdentityBindingStatus(ctx context.Context, orgID, connectionID, bindingID int64, status string) (*domain.IdentityBinding, error) {
	if _, err := b.GetConnection(ctx, orgID, connectionID); err != nil {
		return nil, err
	}
	binding, err := b.repo.GetIdentityBindingByID(ctx, connectionID, bindingID)
	if err != nil {
		return nil, err
	}
	if binding == nil {
		return nil, ErrNotFound
	}
	switch status {
	case domain.BindingBlocked:
	case domain.BindingBound:
		if binding.UserID == nil {
			return nil, fmt.Errorf("%w: cannot bind an identity that never paired", ErrInvalidConfig)
		}
	case domain.BindingPending:
		binding.UserID = nil
	default:
		return nil, fmt.Errorf("%w: unsupported binding status %s", ErrInvalidConfig, status)
	}
	binding.Status = status
	binding.PairingCode = nil
	binding.PairingExpiresAt = nil
	if err := b.repo.UpdateIdentityBinding(ctx, binding); err != nil {
		return nil, err
	}
	return binding, nil
}

func (b *Bridge) DeleteIdentityBinding(ctx context.Context, orgID, connectionID, bindingID int64) error {
	if _, err := b.GetConnection(ctx, orgID, connectionID); err != nil {
		return err
	}
	return b.repo.DeleteIdentityBinding(ctx, connectionID, bindingID)
}
