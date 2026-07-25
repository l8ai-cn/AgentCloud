package sso

import (
	"fmt"
	"strconv"

	"github.com/coreos/go-oidc/v3/oidc"
)

// idTokenClaims decodes email_verified as `any` because the spec says boolean
// but real IdPs also emit "true"/1; a typed field would fail the whole decode.
type idTokenClaims struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified any    `json:"email_verified"`
	Name          string `json:"name"`
	Username      string `json:"preferred_username"`
	Picture       string `json:"picture"`
	Groups        []string `json:"groups"`
	TenantID      string `json:"tenant_id"`
}

func userInfoFromIDToken(idToken *oidc.IDToken) (*UserInfo, error) {
	var claims idTokenClaims
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %w", err)
	}
	return userInfoFromClaims(claims)
}

func userInfoFromClaims(claims idTokenClaims) (*UserInfo, error) {
	// Only `sub` is mandatory. Email is optional because IdPs such as AMP omit
	// it for accounts provisioned without one (student IDs); the user service
	// synthesizes a placeholder address in that case.
	if claims.Sub == "" {
		return nil, fmt.Errorf("%w: sub claim is empty in ID token", ErrAuthFailed)
	}

	return &UserInfo{
		ExternalID:    claims.Sub,
		Email:         claims.Email,
		EmailVerified: claims.Email != "" && claimTruthy(claims.EmailVerified),
		Username:      claims.Username,
		Name:          claims.Name,
		AvatarURL:     claims.Picture,
		Groups:        claims.Groups,
		TenantID:      claims.TenantID,
	}, nil
}

func claimTruthy(value any) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		parsed, err := strconv.ParseBool(v)
		return err == nil && parsed
	case float64:
		return v != 0
	default:
		return false
	}
}
