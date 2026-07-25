package user

import (
	"context"
	"log/slog"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/user"
)

// promoteEmailVerified keeps the local verification flag consistent once a
// trusted IdP has asserted the same address, so later logins do not fall back
// to a placeholder email.
func (s *Service) promoteEmailVerified(ctx context.Context, u *user.User, id ExternalIdentity) {
	if u == nil || !id.EmailVerified || u.IsEmailVerified || id.Email == "" || u.Email != id.Email {
		return
	}
	if err := s.repo.UpdateUser(ctx, u.ID, map[string]interface{}{"is_email_verified": true}); err != nil {
		slog.WarnContext(ctx, "failed to mark IdP-asserted email as verified",
			"user_id", u.ID, "provider", id.Provider, "error", err)
		return
	}
	u.IsEmailVerified = true
}

// syncExternalProfile refreshes display fields from the IdP on every login.
// AMP/OIDC do not expose a writeback profile API to RPs; id_token claims are
// the only supported sync surface. Empty claims are ignored so a sparse
// assertion cannot wipe a previously populated local profile.
func (s *Service) syncExternalProfile(ctx context.Context, u *user.User, id ExternalIdentity) {
	if u == nil {
		return
	}
	updates := map[string]interface{}{}
	if id.Name != "" && (u.Name == nil || *u.Name != id.Name) {
		updates["name"] = id.Name
	}
	if id.AvatarURL != "" && (u.AvatarURL == nil || *u.AvatarURL != id.AvatarURL) {
		updates["avatar_url"] = id.AvatarURL
	}
	if len(updates) == 0 {
		return
	}
	if err := s.repo.UpdateUser(ctx, u.ID, updates); err != nil {
		slog.WarnContext(ctx, "failed to sync profile from IdP",
			"user_id", u.ID, "provider", id.Provider, "error", err)
		return
	}
	if name, ok := updates["name"].(string); ok {
		u.Name = &name
	}
	if avatar, ok := updates["avatar_url"].(string); ok {
		u.AvatarURL = &avatar
	}
}
