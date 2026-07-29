package agentworkbenchconnect

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
)

type stubAMPAuthenticator struct {
	identity *middleware.AMPBearerIdentity
	err      error
}

func (s stubAMPAuthenticator) AuthenticateAMPBearer(
	context.Context,
	string,
) (*middleware.AMPBearerIdentity, error) {
	return s.identity, s.err
}

func ampBusinessToken(t *testing.T) string {
	t.Helper()
	payload, err := json.Marshal(map[string]any{
		"iss":       "https://amp.example.com/api/v1/public/protocols/oidc/apps/ZHIYONG",
		"sub":       "principal:student01",
		"token_use": "amp_business_access",
		"tenant_id": "6",
	})
	require.NoError(t, err)
	encode := base64.RawURLEncoding.EncodeToString
	return encode([]byte(`{"alg":"RS256"}`)) + "." + encode(payload) + ".signature"
}

func runWorkbenchAMPInterceptor(
	t *testing.T,
	authenticator middleware.AMPBearerAuthenticator,
	next connect.UnaryFunc,
) (connect.AnyResponse, error) {
	t.Helper()
	interceptor := NewAuthInterceptor(
		workbenchTestAccessTokenManager(t),
		testAudience,
		nil,
		authenticator,
	)
	request := connect.NewRequest(&struct{}{})
	request.Header().Set("Authorization", "Bearer "+ampBusinessToken(t))
	return interceptor.WrapUnary(next)(context.Background(), request)
}

func TestAgentWorkbenchAuthAcceptsAMPBearer(t *testing.T) {
	authenticator := stubAMPAuthenticator{identity: &middleware.AMPBearerIdentity{
		UserID:         4,
		OrganizationID: 7,
		Username:       "student01",
	}}
	var captured context.Context

	_, err := runWorkbenchAMPInterceptor(
		t,
		authenticator,
		func(ctx context.Context, _ connect.AnyRequest) (connect.AnyResponse, error) {
			captured = ctx
			return connect.NewResponse(&struct{}{}), nil
		},
	)

	require.NoError(t, err)
	tenant := middleware.GetTenant(captured)
	require.NotNil(t, tenant)
	assert.Equal(t, int64(4), tenant.UserID)
	assert.Nil(t, embedAccess(captured))
}

func TestAgentWorkbenchAuthRejectsUnverifiedAMPBearer(t *testing.T) {
	called := false

	_, err := runWorkbenchAMPInterceptor(
		t,
		stubAMPAuthenticator{err: errors.New("signature mismatch")},
		func(context.Context, connect.AnyRequest) (connect.AnyResponse, error) {
			called = true
			return nil, nil
		},
	)

	assert.False(t, called)
	var connectErr *connect.Error
	require.ErrorAs(t, err, &connectErr)
	assert.Equal(t, connect.CodeUnauthenticated, connectErr.Code())
}
