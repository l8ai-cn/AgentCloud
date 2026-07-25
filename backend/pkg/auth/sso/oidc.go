package sso

import (
	"context"
	"fmt"
	"sort"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type OIDCConfig struct {
	IssuerURL    string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
	// AuthorizeExtraParams carries IdP-specific authorize parameters that are
	// not part of the OIDC core request. AMP for instance rejects the request
	// with access_denied unless `tenantId` selects the target authz tenant.
	AuthorizeExtraParams map[string]string
}

// reservedAuthorizeParams are owned by the protocol layer. Letting a
// per-IdP extra param shadow one of these would silently disable PKCE or
// CSRF protection instead of failing loudly.
var reservedAuthorizeParams = map[string]struct{}{
	"response_type":         {},
	"client_id":             {},
	"redirect_uri":          {},
	"scope":                 {},
	"state":                 {},
	"nonce":                 {},
	"code_challenge":        {},
	"code_challenge_method": {},
}

type OIDCProvider struct {
	config   *OIDCConfig
	provider *oidc.Provider
	oauth2   oauth2.Config
	verifier *oidc.IDTokenVerifier
}

func NewOIDCProvider(ctx context.Context, cfg *OIDCConfig) (*OIDCProvider, error) {
	if cfg.IssuerURL == "" || cfg.ClientID == "" {
		return nil, fmt.Errorf("%w: missing OIDC issuer URL or client ID", ErrInvalidConfig)
	}

	provider, err := oidc.NewProvider(ctx, cfg.IssuerURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	scopes := cfg.Scopes
	if len(scopes) == 0 {
		scopes = []string{oidc.ScopeOpenID, "email", "profile"}
	}

	endpoint := provider.Endpoint()
	// AMP reads client_secret from the token request body; pinning the auth
	// style avoids oauth2's probe request that first tries HTTP Basic.
	endpoint.AuthStyle = oauth2.AuthStyleInParams

	oauth2Cfg := oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     endpoint,
		Scopes:       scopes,
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: cfg.ClientID})

	return &OIDCProvider{
		config:   cfg,
		provider: provider,
		oauth2:   oauth2Cfg,
		verifier: verifier,
	}, nil
}

// GetAuthURL exists to satisfy Provider. OIDC always goes through
// GetAuthURLWithPKCE because a nonce and an S256 challenge are mandatory.
func (p *OIDCProvider) GetAuthURL(_ context.Context, _ string) (string, error) {
	return "", fmt.Errorf("%w: OIDC requires nonce and PKCE, use GetAuthURLWithPKCE", ErrNotSupported)
}

func (p *OIDCProvider) GetAuthURLWithPKCE(_ context.Context, state, nonce, codeVerifier string) (string, error) {
	if state == "" || nonce == "" || codeVerifier == "" {
		return "", fmt.Errorf("%w: state, nonce and code verifier are all required", ErrInvalidConfig)
	}

	opts := []oauth2.AuthCodeOption{
		oidc.Nonce(nonce),
		oauth2.S256ChallengeOption(codeVerifier),
	}
	for _, key := range sortedExtraParamKeys(p.config.AuthorizeExtraParams) {
		opts = append(opts, oauth2.SetAuthURLParam(key, p.config.AuthorizeExtraParams[key]))
	}

	return p.oauth2.AuthCodeURL(state, opts...), nil
}

func sortedExtraParamKeys(params map[string]string) []string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if key == "" || value == "" {
			continue
		}
		if _, reserved := reservedAuthorizeParams[key]; reserved {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func (p *OIDCProvider) HandleCallback(ctx context.Context, params map[string]string) (*UserInfo, error) {
	code := params["code"]
	if code == "" {
		return nil, fmt.Errorf("%w: missing authorization code", ErrAuthFailed)
	}
	codeVerifier := params["code_verifier"]
	if codeVerifier == "" {
		return nil, fmt.Errorf("%w: missing PKCE code verifier", ErrAuthFailed)
	}
	expectedNonce := params["nonce"]
	if expectedNonce == "" {
		return nil, fmt.Errorf("%w: missing expected nonce", ErrAuthFailed)
	}

	token, err := p.oauth2.Exchange(ctx, code, oauth2.VerifierOption(codeVerifier))
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, fmt.Errorf("%w: no id_token in response", ErrAuthFailed)
	}

	idToken, err := p.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify ID token: %w", err)
	}
	if idToken.Nonce != expectedNonce {
		return nil, fmt.Errorf("%w: ID token nonce mismatch", ErrAuthFailed)
	}

	info, err := userInfoFromIDToken(idToken)
	if err != nil {
		return nil, err
	}
	enrichUserInfoFromAccessToken(info, token.AccessToken)
	return info, nil
}

func (p *OIDCProvider) Authenticate(_ context.Context, _, _ string) (*UserInfo, error) {
	return nil, ErrNotSupported
}
