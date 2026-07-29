package interceptors_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/internal/api/connect/interceptors"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
)

type stubAMPAuthenticator struct {
	identity *middleware.AMPBearerIdentity
	err      error
	calls    int
}

func (s *stubAMPAuthenticator) AuthenticateAMPBearer(
	context.Context,
	string,
) (*middleware.AMPBearerIdentity, error) {
	s.calls++
	return s.identity, s.err
}

// The interceptor routes on the unverified issuer claim, so the stub only needs
// a decodable payload; signature checking belongs to the verifier under test in
// pkg/ampbearer.
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

func runAMPInterceptor(
	t *testing.T,
	authenticator middleware.AMPBearerAuthenticator,
	next connect.UnaryFunc,
) (connect.AnyResponse, error) {
	t.Helper()
	fixture := newTokenFixture(t)
	interceptor := interceptors.NewAuthInterceptor(
		fixture.manager,
		connectAudience,
		authenticator,
	)
	req := connect.NewRequest(&echoReq{Msg: "hi"})
	req.Header().Set("Authorization", "Bearer "+ampBusinessToken(t))
	return interceptor.WrapUnary(next)(context.Background(), req)
}

func TestAuthInterceptorAMPBearerPopulatesFederatedUser(t *testing.T) {
	authenticator := &stubAMPAuthenticator{identity: &middleware.AMPBearerIdentity{
		UserID:         4,
		Email:          "student01@example.com",
		Username:       "student01",
		OrganizationID: 7,
		TenantID:       "6",
		AppCode:        "ZHIYONG",
	}}
	var captured context.Context

	_, err := runAMPInterceptor(t, authenticator, okHandler(&captured))

	require.NoError(t, err)
	assert.Equal(t, 1, authenticator.calls)
	tenant := middleware.GetTenant(captured)
	require.NotNil(t, tenant)
	assert.Equal(t, int64(4), tenant.UserID)
	claims := interceptors.ClaimsFromContext(captured)
	require.NotNil(t, claims)
	assert.Equal(t, "student01", claims.Username)
}

func TestAuthInterceptorAMPBearerRejectionDoesNotFallThrough(t *testing.T) {
	authenticator := &stubAMPAuthenticator{err: errors.New("signature mismatch")}
	called := false

	_, err := runAMPInterceptor(
		t,
		authenticator,
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

func TestResolveOrgScopeRejectsOrgOutsideAMPTenant(t *testing.T) {
	authenticator := &stubAMPAuthenticator{identity: &middleware.AMPBearerIdentity{
		UserID:         4,
		OrganizationID: 7,
	}}
	svc := &fakeOrgService{
		bySlug:   map[string]fakeOrg{"acme": {id: 7, slug: "acme"}, "other": {id: 8, slug: "other"}},
		roles:    map[int64]string{4: "member"},
		isMember: true,
	}
	var captured context.Context
	_, err := runAMPInterceptor(t, authenticator, okHandler(&captured))
	require.NoError(t, err)

	_, _, sameTenantErr := interceptors.ResolveOrgScope(
		captured,
		&fakeOrgScopedReq{OrgSlug: "acme"},
		svc,
	)
	require.NoError(t, sameTenantErr)

	_, _, crossTenantErr := interceptors.ResolveOrgScope(
		captured,
		&fakeOrgScopedReq{OrgSlug: "other"},
		svc,
	)

	var connectErr *connect.Error
	require.ErrorAs(t, crossTenantErr, &connectErr)
	assert.Equal(t, connect.CodePermissionDenied, connectErr.Code())
}
