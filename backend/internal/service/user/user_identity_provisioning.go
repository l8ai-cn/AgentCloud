package user

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/user"
)

// ExternalIdentity describes an identity asserted by an external IdP.
type ExternalIdentity struct {
	Provider       string
	ProviderUserID string
	Username       string
	Email          string
	Name           string
	AvatarURL      string
	// EmailVerified marks the IdP's email assertion as trusted. It allows
	// linking onto an existing local account with the same address instead of
	// falling back to a placeholder, and provisions the account as verified.
	// Only set it for IdPs the operator has explicitly made authoritative for
	// that email domain — a forged assertion would take over the account.
	EmailVerified bool
}

func (s *Service) GetOrCreateByOAuth(ctx context.Context, provider, providerUserID, providerUsername, email, name, avatarURL string) (*user.User, bool, error) {
	return s.GetOrCreateByExternalIdentity(ctx, ExternalIdentity{
		Provider:       provider,
		ProviderUserID: providerUserID,
		Username:       providerUsername,
		Email:          email,
		Name:           name,
		AvatarURL:      avatarURL,
	})
}

func (s *Service) GetOrCreateByExternalIdentity(ctx context.Context, id ExternalIdentity) (*user.User, bool, error) {
	return s.getOrCreateByExternalIdentityOnce(ctx, id, true)
}

func (s *Service) getOrCreateByExternalIdentityOnce(ctx context.Context, id ExternalIdentity, allowRetry bool) (*user.User, bool, error) {
	identity, err := s.repo.GetIdentityByProviderUser(ctx, id.Provider, id.ProviderUserID)
	if err == nil {
		u, err := s.GetByID(ctx, identity.UserID)
		if err != nil {
			return nil, false, err
		}
		s.promoteEmailVerified(ctx, u, id)
		return u, false, nil
	}

	u, isNew, err := s.resolveIdentityUser(ctx, id, allowRetry)
	if err != nil || u == nil {
		return u, isNew, err
	}

	newIdentity := &user.Identity{
		UserID:         u.ID,
		Provider:       id.Provider,
		ProviderUserID: id.ProviderUserID,
	}
	if id.Username != "" {
		newIdentity.ProviderUsername = &id.Username
	}

	if err := s.repo.CreateIdentity(ctx, newIdentity); err != nil {
		if allowRetry && isConflictError(err) {
			slog.WarnContext(ctx, "oauth identity creation conflict, retrying",
				"provider", id.Provider, "provider_user_id", id.ProviderUserID)
			return s.getOrCreateByExternalIdentityOnce(ctx, id, false)
		}
		slog.ErrorContext(ctx, "failed to create oauth identity",
			"user_id", u.ID, "provider", id.Provider, "error", err)
		return nil, false, err
	}

	return u, isNew, nil
}

// resolveIdentityUser links the assertion onto an existing account when the
// email can be trusted, otherwise provisions a new one.
func (s *Service) resolveIdentityUser(ctx context.Context, id ExternalIdentity, allowRetry bool) (*user.User, bool, error) {
	emailTaken := false
	if id.Email != "" {
		existing, err := s.GetByEmail(ctx, id.Email)
		if err == nil {
			if existing.IsEmailVerified || id.EmailVerified {
				s.promoteEmailVerified(ctx, existing, id)
				return existing, false, nil
			}
			emailTaken = true
			slog.WarnContext(ctx, "oauth email matches unverified account, using placeholder",
				"provider", id.Provider, "email", id.Email)
		}
	}

	userEmail := id.Email
	if userEmail == "" || emailTaken {
		userEmail = fmt.Sprintf("%s_%s@noemail.agentcloud.placeholder", id.Provider, id.ProviderUserID)
	}

	username, err := s.EnsureUniqueUsername(ctx, usernameSeeds(id.Username, id.Email, id.Name))
	if err != nil {
		slog.ErrorContext(ctx, "failed to derive unique username",
			"provider", id.Provider, "provider_user_id", id.ProviderUserID, "error", err)
		return nil, false, err
	}

	u := &user.User{
		Email:           userEmail,
		Username:        username,
		IsActive:        true,
		IsEmailVerified: id.EmailVerified && userEmail == id.Email,
	}
	if id.Name != "" {
		u.Name = &id.Name
	}
	if id.AvatarURL != "" {
		u.AvatarURL = &id.AvatarURL
	}

	if err := s.repo.CreateUser(ctx, u); err != nil {
		if allowRetry && isConflictError(err) {
			slog.WarnContext(ctx, "oauth user creation conflict, retrying",
				"provider", id.Provider, "provider_user_id", id.ProviderUserID)
			retried, isNew, retryErr := s.getOrCreateByExternalIdentityOnce(ctx, id, false)
			return retried, isNew, retryErr
		}
		slog.ErrorContext(ctx, "failed to create oauth user",
			"provider", id.Provider, "provider_user_id", id.ProviderUserID, "error", err)
		return nil, false, err
	}
	slog.InfoContext(ctx, "oauth user created",
		"user_id", u.ID, "provider", id.Provider, "provider_user_id", id.ProviderUserID)
	return u, true, nil
}

func isConflictError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "duplicate key value") ||
		strings.Contains(msg, "UNIQUE constraint failed") ||
		strings.Contains(msg, "Duplicate entry")
}

// usernameSeeds builds the priority-ordered seed list for EnsureUniqueUsername:
// provider's own username first (most identity-preserving), then email
// local-part, then human name. Empty/garbage seeds are dropped silently and
// EnsureUniqueUsername falls back to a random user-{hex} handle.
func usernameSeeds(providerUsername, email, name string) []string {
	seeds := make([]string, 0, 3)
	if providerUsername != "" {
		seeds = append(seeds, providerUsername)
	}
	if email != "" {
		if local := strings.SplitN(email, "@", 2)[0]; local != "" {
			seeds = append(seeds, local)
		}
	}
	if name != "" {
		seeds = append(seeds, name)
	}
	return seeds
}
