package sso

import (
	"context"
	"errors"
)

var (
	ErrNotSupported  = errors.New("operation not supported for this protocol")
	ErrAuthFailed    = errors.New("authentication failed")
	ErrInvalidConfig = errors.New("invalid SSO configuration")
)

type UserInfo struct {
	ExternalID string // IdP subject / NameID / LDAP DN
	Email      string
	// EmailVerified reflects the IdP's assertion. Whether it is trusted enough
	// to link an existing local account is decided by the calling service.
	EmailVerified bool
	Username      string
	Name          string
	AvatarURL     string
	Groups        []string
	// TenantID is the IdP's tenant / authz_tenant claim when present.
	TenantID string
	// Roles are IdP application roles (e.g. AMP business JWT `roles`).
	// Used to sync organization_members.role on federated login.
	Roles []string
}

type Provider interface {
	GetAuthURL(ctx context.Context, state string) (string, error)
	HandleCallback(ctx context.Context, params map[string]string) (*UserInfo, error)
	Authenticate(ctx context.Context, username, password string) (*UserInfo, error)
}

// PKCEProvider is implemented by protocols whose authorization request must
// carry a nonce and an S256 code challenge, making the plain GetAuthURL
// unusable. HandleCallback then expects `code_verifier` and `nonce` in params.
type PKCEProvider interface {
	Provider
	GetAuthURLWithPKCE(ctx context.Context, state, nonce, codeVerifier string) (string, error)
}
