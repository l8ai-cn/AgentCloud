package user

import (
	"context"
	"log/slog"
	"time"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/user"
	"github.com/l8ai-cn/agentcloud/backend/pkg/crypto"
)

func (s *Service) UpdateIdentityTokens(ctx context.Context, userID int64, provider, accessToken, refreshToken string, expiresAt *time.Time) error {
	updates := map[string]interface{}{
		"token_expires_at": expiresAt,
	}

	if s.encryptionKey != "" {
		if accessToken != "" {
			encrypted, err := crypto.EncryptWithKey(accessToken, s.encryptionKey)
			if err != nil {
				slog.ErrorContext(ctx, "failed to encrypt oauth access token",
					"user_id", userID, "provider", provider, "error", err)
				return err
			}
			updates["access_token_encrypted"] = encrypted
		}
		if refreshToken != "" {
			encrypted, err := crypto.EncryptWithKey(refreshToken, s.encryptionKey)
			if err != nil {
				slog.ErrorContext(ctx, "failed to encrypt oauth refresh token",
					"user_id", userID, "provider", provider, "error", err)
				return err
			}
			updates["refresh_token_encrypted"] = encrypted
		}
	} else {
		slog.WarnContext(ctx, "storing oauth tokens without encryption",
			"user_id", userID, "provider", provider)
		if accessToken != "" {
			updates["access_token_encrypted"] = accessToken
		}
		if refreshToken != "" {
			updates["refresh_token_encrypted"] = refreshToken
		}
	}

	return s.repo.UpdateIdentityFields(ctx, userID, provider, updates)
}

func (s *Service) GetIdentity(ctx context.Context, userID int64, provider string) (*user.Identity, error) {
	return s.repo.GetIdentity(ctx, userID, provider)
}

func (s *Service) GetIdentityByProvider(ctx context.Context, userID int64, provider string) (*user.Identity, error) {
	return s.GetIdentity(ctx, userID, provider)
}

type DecryptedTokens struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    *time.Time
}

func (s *Service) GetDecryptedTokens(ctx context.Context, userID int64, provider string) (*DecryptedTokens, error) {
	identity, err := s.GetIdentity(ctx, userID, provider)
	if err != nil {
		return nil, err
	}

	tokens := &DecryptedTokens{
		ExpiresAt: identity.TokenExpiresAt,
	}

	if s.encryptionKey != "" {
		if identity.AccessTokenEncrypted != nil && *identity.AccessTokenEncrypted != "" {
			decrypted, err := crypto.DecryptWithKey(*identity.AccessTokenEncrypted, s.encryptionKey)
			if err != nil {
				return nil, err
			}
			tokens.AccessToken = decrypted
		}
		if identity.RefreshTokenEncrypted != nil && *identity.RefreshTokenEncrypted != "" {
			decrypted, err := crypto.DecryptWithKey(*identity.RefreshTokenEncrypted, s.encryptionKey)
			if err != nil {
				return nil, err
			}
			tokens.RefreshToken = decrypted
		}
	} else {
		if identity.AccessTokenEncrypted != nil {
			tokens.AccessToken = *identity.AccessTokenEncrypted
		}
		if identity.RefreshTokenEncrypted != nil {
			tokens.RefreshToken = *identity.RefreshTokenEncrypted
		}
	}

	return tokens, nil
}

func (s *Service) ListIdentities(ctx context.Context, userID int64) ([]*user.Identity, error) {
	return s.repo.ListIdentities(ctx, userID)
}

func (s *Service) DeleteIdentity(ctx context.Context, userID int64, provider string) error {
	slog.InfoContext(ctx, "deleting oauth identity", "user_id", userID, "provider", provider)
	return s.repo.DeleteIdentity(ctx, userID, provider)
}
