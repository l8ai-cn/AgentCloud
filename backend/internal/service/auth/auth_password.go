package auth

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	userService "github.com/l8ai-cn/agentcloud/backend/internal/service/user"
)

func (s *Service) Login(ctx context.Context, identifier, password string) (*LoginResult, error) {
	if s.ssoChecker != nil && identifier != "" {
		u, err := s.userService.GetByUsername(ctx, identifier)
		if err != nil && strings.Contains(identifier, "@") {
			u, err = s.userService.GetByEmail(ctx, identifier)
		}
		if err == nil && u != nil {
			allowed, err := s.ssoChecker.IsPasswordLoginAllowed(ctx, u.Email, u.IsSystemAdmin)
			if err == nil && !allowed {
				return nil, ErrSSOEnforced
			}
		}
	}

	u, err := s.userService.Authenticate(ctx, identifier, password)
	if err != nil {
		if errors.Is(err, userService.ErrInvalidCredentials) {
			slog.WarnContext(ctx, "login failed", "identifier", identifier, "reason", "invalid_credentials")
			return nil, ErrInvalidCredentials
		}
		if errors.Is(err, userService.ErrUserInactive) {
			slog.WarnContext(ctx, "login failed", "identifier", identifier, "reason", "user_disabled")
			return nil, ErrUserDisabled
		}
		slog.WarnContext(ctx, "login failed", "identifier", identifier, "reason", "internal_error")
		return nil, err
	}

	tokens, err := s.GenerateTokenPair(u, 0, "")
	if err != nil {
		return nil, err
	}

	slog.InfoContext(ctx, "user logged in", "user_id", u.ID, "username", u.Username)

	return &LoginResult{
		User:         u,
		Token:        tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    int64(s.config.JWTExpiration.Seconds()),
	}, nil
}

// Register is permanently closed. Identity is provisioned through AMP / SSO;
// local password signup must not create a second account authority.
func (s *Service) Register(context.Context, *RegisterRequest) (*LoginResult, error) {
	return nil, ErrRegistrationDisabled
}
