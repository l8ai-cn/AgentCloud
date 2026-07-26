package imbridge

import (
	"context"
	"crypto/rand"
	"math/big"
	"strings"
	"time"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type identityResolution struct {
	UserID  int64
	Binding *domain.IdentityBinding
	Pending bool
	Code    string
}

func (b *Bridge) resolveIdentity(ctx context.Context, conn *domain.Connection, event *InboundEvent) (*identityResolution, error) {
	extID := strings.TrimSpace(event.ExternalUserID)
	if extID == "" {
		extID = strings.TrimSpace(event.SenderName)
	}
	if extID == "" {
		return &identityResolution{UserID: conn.CreatedByUserID}, nil
	}
	binding, err := b.repo.GetIdentityBinding(ctx, conn.ID, extID)
	if err != nil {
		return nil, err
	}
	if binding != nil && binding.Status == domain.BindingBound && binding.UserID != nil {
		return &identityResolution{UserID: *binding.UserID, Binding: binding}, nil
	}
	if binding != nil && binding.Status == domain.BindingBlocked {
		return nil, ErrUnauthorized
	}
	// Pairing applies to DMs; group traffic falls back to connection owner unless bound.
	if inferPeerKind(event) == domain.PeerGroup {
		return &identityResolution{UserID: conn.CreatedByUserID, Binding: binding}, nil
	}
	switch conn.DMPolicy {
	case domain.DMPolicyOpen:
		return &identityResolution{UserID: conn.CreatedByUserID}, nil
	case domain.DMPolicyGuest:
		return &identityResolution{UserID: conn.CreatedByUserID, Pending: true}, nil
	case domain.DMPolicyDisabled:
		return nil, ErrUnauthorized
	case domain.DMPolicyAllowlist:
		if !allowFromMatches(conn.AllowFrom, extID, event.SenderName) {
			return nil, ErrUnauthorized
		}
		return &identityResolution{UserID: conn.CreatedByUserID}, nil
	default: // pairing
		code, pending, err := b.ensurePairing(ctx, conn, extID, event.SenderName, binding)
		if err != nil {
			return nil, err
		}
		return &identityResolution{UserID: conn.CreatedByUserID, Binding: pending, Pending: true, Code: code}, nil
	}
}

func (b *Bridge) ensurePairing(ctx context.Context, conn *domain.Connection, extID, name string, existing *domain.IdentityBinding) (string, *domain.IdentityBinding, error) {
	now := time.Now().UTC()
	if existing != nil && existing.PairingCode != nil && existing.PairingExpiresAt != nil && existing.PairingExpiresAt.After(now) {
		return *existing.PairingCode, existing, nil
	}
	code, err := randomPairingCode()
	if err != nil {
		return "", nil, err
	}
	exp := now.Add(10 * time.Minute)
	namePtr := strPtrIf(name)
	binding := &domain.IdentityBinding{
		ConnectionID:     conn.ID,
		ExternalUserID:   extID,
		ExternalName:     namePtr,
		Status:           domain.BindingPending,
		PairingCode:      &code,
		PairingExpiresAt: &exp,
	}
	if err := b.repo.UpsertIdentityBinding(ctx, binding); err != nil {
		return "", nil, err
	}
	return code, binding, nil
}

func randomPairingCode() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	out := make([]byte, 6)
	for i := range out {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		out[i] = alphabet[n.Int64()]
	}
	return string(out), nil
}

func pairingPrompt(conn *domain.Connection, code string) string {
	return botText(conn, "pairing_prompt", code)
}
