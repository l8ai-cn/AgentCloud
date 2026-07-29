package ampbearer_test

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

const testAppPath = "/api/v1/public/protocols/oidc/apps/ZHIYONG"

// testIdP stands in for one AMP deployment: discovery plus JWKS under an
// app-scoped issuer, which is the shape SplitIssuer and the verifier expect.
type testIdP struct {
	server *httptest.Server
	key    *rsa.PrivateKey
	issuer string
}

func newTestIdP(t *testing.T) *testIdP {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	idp := &testIdP{key: key}
	mux := http.NewServeMux()
	mux.HandleFunc(testAppPath+"/.well-known/openid-configuration",
		func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, map[string]any{
				"issuer":                                idp.issuer,
				"jwks_uri":                              idp.issuer + "/jwks",
				"id_token_signing_alg_values_supported": []string{"RS256"},
			})
		})
	mux.HandleFunc(testAppPath+"/jwks", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"keys": []any{jwkFor(&key.PublicKey)}})
	})

	idp.server = httptest.NewServer(mux)
	idp.issuer = idp.server.URL + testAppPath
	t.Cleanup(idp.server.Close)
	return idp
}

func (i *testIdP) sign(t *testing.T, claims map[string]any) string {
	t.Helper()
	if _, ok := claims["exp"]; !ok {
		claims["exp"] = time.Now().Add(time.Hour).Unix()
	}
	if _, ok := claims["iss"]; !ok {
		claims["iss"] = i.issuer
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims(claims))
	token.Header["kid"] = "oidc-primary"
	signed, err := token.SignedString(i.key)
	require.NoError(t, err)
	return signed
}

func (i *testIdP) signWithForeignKey(t *testing.T, claims map[string]any) string {
	t.Helper()
	foreign, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	if _, ok := claims["exp"]; !ok {
		claims["exp"] = time.Now().Add(time.Hour).Unix()
	}
	if _, ok := claims["iss"]; !ok {
		claims["iss"] = i.issuer
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims(claims))
	token.Header["kid"] = "oidc-primary"
	signed, err := token.SignedString(foreign)
	require.NoError(t, err)
	return signed
}

func validClaims() map[string]any {
	return map[string]any{
		"token_use":      "amp_business_access",
		"principal_type": "user_session",
		"app_code":       "ZHIYONG",
		"sub":            "principal:union-1",
		"tenant_id":      "6",
		"user_id":        "student-1",
		"roles":          []string{"APP_USER"},
	}
}

func unsignedToken(t *testing.T, claims map[string]any) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	require.NoError(t, err)
	return "header." + base64.RawURLEncoding.EncodeToString(payload) + ".signature"
}

func jwkFor(pub *rsa.PublicKey) map[string]any {
	return map[string]any{
		"kty": "RSA",
		"alg": "RS256",
		"use": "sig",
		"kid": "oidc-primary",
		"n":   base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
		"e":   base64.RawURLEncoding.EncodeToString(big(pub.E)),
	}
}

func big(value int) []byte {
	out := []byte{byte(value >> 16), byte(value >> 8), byte(value)}
	for len(out) > 1 && out[0] == 0 {
		out = out[1:]
	}
	return out
}

func writeJSON(w http.ResponseWriter, body any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(body)
}
