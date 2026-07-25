package sso

import (
	"context"
	"os"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

// testRedis backs the OIDC PKCE state store for the whole package. OIDC login
// hard-requires Redis, so every service built by newTestService needs one.
var testRedis *redis.Client

func TestMain(m *testing.M) {
	server, err := miniredis.Run()
	if err != nil {
		panic(err)
	}
	testRedis = redis.NewClient(&redis.Options{Addr: server.Addr()})

	code := m.Run()

	_ = testRedis.Close()
	server.Close()
	os.Exit(code)
}

// oidcCallbackParams seeds the PKCE verifier and nonce the OIDC callback
// expects, mirroring what GetAuthURL would have stored.
func oidcCallbackParams(t *testing.T, svc *Service, state, code string) map[string]string {
	t.Helper()
	require.NoError(t, svc.storeOIDCAuthState(context.Background(), state, oidcAuthState{
		CodeVerifier: "test-code-verifier",
		Nonce:        "test-nonce",
	}))
	return map[string]string{"code": code, "state": state}
}
