package sso

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newStubIdP serves just enough discovery for NewOIDCProvider; the authorize
// and token endpoints are never called by these tests.
func newStubIdP(t *testing.T) string {
	t.Helper()
	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{
			"issuer": %q,
			"authorization_endpoint": "%s/authorize",
			"token_endpoint": "%s/token",
			"jwks_uri": "%s/jwks",
			"id_token_signing_alg_values_supported": ["RS256"]
		}`, server.URL, server.URL, server.URL, server.URL)
	})
	return server.URL
}

func newStubOIDCProvider(t *testing.T, extra map[string]string) *OIDCProvider {
	t.Helper()
	provider, err := NewOIDCProvider(context.Background(), &OIDCConfig{
		IssuerURL:            newStubIdP(t),
		ClientID:             "agentcloud",
		ClientSecret:         "secret",
		RedirectURL:          "https://app.example.com/callback",
		AuthorizeExtraParams: extra,
	})
	require.NoError(t, err)
	return provider
}

func authURLQuery(t *testing.T, rawURL string) url.Values {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	require.NoError(t, err)
	return parsed.Query()
}

func TestGetAuthURL_RefusesNonPKCEFlow(t *testing.T) {
	provider := newStubOIDCProvider(t, nil)

	_, err := provider.GetAuthURL(context.Background(), "state-1")
	require.ErrorIs(t, err, ErrNotSupported)
}

func TestGetAuthURLWithPKCE_CarriesNonceAndS256Challenge(t *testing.T) {
	provider := newStubOIDCProvider(t, nil)

	authURL, err := provider.GetAuthURLWithPKCE(context.Background(), "state-1", "nonce-1", "verifier-1")
	require.NoError(t, err)

	query := authURLQuery(t, authURL)
	assert.Equal(t, "state-1", query.Get("state"))
	assert.Equal(t, "nonce-1", query.Get("nonce"))
	assert.Equal(t, "S256", query.Get("code_challenge_method"))
	assert.NotEmpty(t, query.Get("code_challenge"))
	assert.NotEqual(t, "verifier-1", query.Get("code_challenge"), "verifier must never leave the server")
}

func TestGetAuthURLWithPKCE_CarriesExtraParams(t *testing.T) {
	provider := newStubOIDCProvider(t, map[string]string{"tenantId": "tenant-9"})

	authURL, err := provider.GetAuthURLWithPKCE(context.Background(), "state-1", "nonce-1", "verifier-1")
	require.NoError(t, err)
	assert.Equal(t, "tenant-9", authURLQuery(t, authURL).Get("tenantId"))
}

func TestGetAuthURLWithPKCE_IgnoresReservedAndEmptyExtraParams(t *testing.T) {
	provider := newStubOIDCProvider(t, map[string]string{
		"code_challenge_method": "plain",
		"state":                 "attacker-state",
		"tenantId":              "",
		"":                      "orphan",
	})

	authURL, err := provider.GetAuthURLWithPKCE(context.Background(), "state-1", "nonce-1", "verifier-1")
	require.NoError(t, err)

	query := authURLQuery(t, authURL)
	assert.Equal(t, "S256", query.Get("code_challenge_method"))
	assert.Equal(t, []string{"state-1"}, query["state"])
	assert.NotContains(t, query, "tenantId")
}

func TestGetAuthURLWithPKCE_RequiresAllSecrets(t *testing.T) {
	provider := newStubOIDCProvider(t, nil)

	cases := map[string][3]string{
		"missing state":    {"", "nonce-1", "verifier-1"},
		"missing nonce":    {"state-1", "", "verifier-1"},
		"missing verifier": {"state-1", "nonce-1", ""},
	}
	for name, args := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := provider.GetAuthURLWithPKCE(context.Background(), args[0], args[1], args[2])
			require.ErrorIs(t, err, ErrInvalidConfig)
		})
	}
}

func TestHandleCallback_RejectsIncompleteParams(t *testing.T) {
	provider := newStubOIDCProvider(t, nil)

	cases := map[string]map[string]string{
		"missing code":     {"code_verifier": "v", "nonce": "n"},
		"missing verifier": {"code": "c", "nonce": "n"},
		"missing nonce":    {"code": "c", "code_verifier": "v"},
	}
	for name, params := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := provider.HandleCallback(context.Background(), params)
			require.ErrorIs(t, err, ErrAuthFailed)
		})
	}
}
