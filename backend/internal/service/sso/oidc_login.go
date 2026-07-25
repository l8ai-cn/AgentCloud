package sso

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/sso"
	ssoprovider "github.com/l8ai-cn/agentcloud/backend/pkg/auth/sso"
	"golang.org/x/oauth2"
)

const (
	oidcAuthStatePrefix = "sso:oidc:authstate:"
	oidcAuthStateTTL    = 10 * time.Minute
)

var (
	// ErrOIDCAuthStateMissing means the PKCE verifier and nonce bound to this
	// state are gone (expired, replayed, or never issued).
	ErrOIDCAuthStateMissing = errors.New("OIDC authorization state not found or expired")
	// ErrOIDCRedisRequired guards the PKCE round trip. Unlike SAML request-ID
	// tracking this cannot degrade gracefully: IdPs such as AMP mandate PKCE,
	// and a lost verifier only surfaces as an opaque invalid_grant at the token
	// endpoint.
	ErrOIDCRedisRequired = errors.New("OIDC login requires Redis to hold the PKCE verifier")
)

type oidcAuthState struct {
	CodeVerifier string `json:"code_verifier"`
	Nonce        string `json:"nonce"`
}

func (s *Service) oidcAuthURL(ctx context.Context, cfg *sso.Config, state string) (string, error) {
	provider, err := s.buildProvider(ctx, cfg)
	if err != nil {
		return "", fmt.Errorf("failed to build OIDC provider: %w", err)
	}
	pkceProvider, ok := provider.(ssoprovider.PKCEProvider)
	if !ok {
		return "", fmt.Errorf("%w: OIDC provider does not support PKCE", ErrInvalidProtocol)
	}

	authState := oidcAuthState{
		CodeVerifier: oauth2.GenerateVerifier(),
		Nonce:        oauth2.GenerateVerifier(),
	}
	if err := s.storeOIDCAuthState(ctx, state, authState); err != nil {
		return "", err
	}

	return pkceProvider.GetAuthURLWithPKCE(ctx, state, authState.Nonce, authState.CodeVerifier)
}

// injectOIDCCallbackParams moves the PKCE verifier and expected nonce from the
// server-side store into the provider params, keyed by the state the IdP echoed.
func (s *Service) injectOIDCCallbackParams(ctx context.Context, params map[string]string) error {
	state := params["state"]
	if state == "" {
		return ErrOIDCAuthStateMissing
	}
	authState, err := s.consumeOIDCAuthState(ctx, state)
	if err != nil {
		return err
	}
	params["code_verifier"] = authState.CodeVerifier
	params["nonce"] = authState.Nonce
	return nil
}

func (s *Service) storeOIDCAuthState(ctx context.Context, state string, authState oidcAuthState) error {
	if s.redis == nil {
		return ErrOIDCRedisRequired
	}
	payload, err := json.Marshal(authState)
	if err != nil {
		return fmt.Errorf("failed to encode OIDC authorization state: %w", err)
	}
	if err := s.redis.Set(ctx, oidcAuthStatePrefix+state, payload, oidcAuthStateTTL).Err(); err != nil {
		return fmt.Errorf("failed to store OIDC authorization state: %w", err)
	}
	return nil
}

func (s *Service) consumeOIDCAuthState(ctx context.Context, state string) (oidcAuthState, error) {
	if s.redis == nil {
		return oidcAuthState{}, ErrOIDCRedisRequired
	}
	for _, candidate := range oidcAuthStateLookupCandidates(state) {
		raw, err := s.redis.GetDel(ctx, oidcAuthStatePrefix+candidate).Result()
		if err != nil {
			continue
		}
		var authState oidcAuthState
		if err := json.Unmarshal([]byte(raw), &authState); err != nil {
			return oidcAuthState{}, fmt.Errorf("failed to decode OIDC authorization state: %w", err)
		}
		if authState.CodeVerifier == "" || authState.Nonce == "" {
			return oidcAuthState{}, ErrOIDCAuthStateMissing
		}
		return authState, nil
	}
	return oidcAuthState{}, ErrOIDCAuthStateMissing
}

func oidcAuthStateLookupCandidates(state string) []string {
	seen := make(map[string]struct{}, 4)
	out := make([]string, 0, 4)
	add := func(v string) {
		if v == "" {
			return
		}
		if _, ok := seen[v]; ok {
			return
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	add(state)
	normalized := state
	for i := 0; i < 3; i++ {
		unescaped, err := url.QueryUnescape(normalized)
		if err != nil || unescaped == normalized {
			break
		}
		normalized = unescaped
		add(normalized)
	}
	return out
}

// decodeAuthorizeExtraParams fails loudly on malformed JSON: silently dropping
// a param like AMP's tenantId turns into an opaque access_denied at the IdP.
func decodeAuthorizeExtraParams(raw *string) (map[string]string, error) {
	if raw == nil || *raw == "" {
		return nil, nil
	}
	var params map[string]string
	if err := json.Unmarshal([]byte(*raw), &params); err != nil {
		return nil, fmt.Errorf("invalid oidc_authorize_extra_params: %w", err)
	}
	return params, nil
}
