package middleware

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubAMPAuthenticator struct {
	identity *AMPBearerIdentity
	err      error
	calls    int
}

func (s *stubAMPAuthenticator) AuthenticateAMPBearer(
	_ context.Context,
	_ string,
) (*AMPBearerIdentity, error) {
	s.calls++
	if s.err != nil {
		return nil, s.err
	}
	return s.identity, nil
}

func ampBearerRequest(t *testing.T, amp AMPBearerAuthenticator, token string) (*httptest.ResponseRecorder, *gin.Context) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	response := httptest.NewRecorder()
	router := gin.New()
	var captured *gin.Context
	router.GET("/",
		AuthMiddlewareWithAMPBearer(nil, "agentcloud-api", amp),
		func(c *gin.Context) {
			captured = c
			c.Status(http.StatusOK)
		})
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(response, request)
	return response, captured
}

func TestAMPBearerAuthenticatesFederatedUser(t *testing.T) {
	amp := &stubAMPAuthenticator{identity: &AMPBearerIdentity{
		UserID:         7,
		Email:          "student@example.com",
		Username:       "student",
		OrganizationID: 2,
	}}

	response, c := ampBearerRequest(t, amp, ampToken(t))

	require.Equal(t, http.StatusOK, response.Code)
	require.NotNil(t, c)
	assert.Equal(t, int64(7), GetUserID(c))
	assert.Equal(t, "student", c.GetString("username"))
	assert.Equal(t, AuthTypeAMPBearer, c.GetString("auth_type"))
	orgID, federated := ampOrganizationID(c)
	assert.True(t, federated)
	assert.Equal(t, int64(2), orgID)
}

// A forged `token_use` must not become a second chance at the local validator.
func TestAMPBearerRejectionDoesNotFallThrough(t *testing.T) {
	amp := &stubAMPAuthenticator{err: errors.New("app code not allowed")}

	response, c := ampBearerRequest(t, amp, ampToken(t))

	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.Nil(t, c)
	assert.Equal(t, 1, amp.calls)
}

func TestAMPBearerIgnoresNonAMPCredential(t *testing.T) {
	amp := &stubAMPAuthenticator{identity: &AMPBearerIdentity{UserID: 7}}

	response, _ := ampBearerRequest(t, amp, localToken(t))

	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.Equal(t, 0, amp.calls, "local tokens must not reach the AMP authenticator")
}

func TestTenantMiddlewareRejectsForeignTenantOrganization(t *testing.T) {
	svc := &mockOrgService{
		org:      &mockOrg{id: 123, slug: "test-org"},
		isMember: true,
		role:     "admin",
	}
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(http.MethodGet, "/orgs/test-org/pods", nil)
	c.Params = gin.Params{{Key: "slug", Value: "test-org"}}
	c.Set("user_id", int64(456))
	c.Set(ampOrgIDKey, int64(999))

	TenantMiddleware(svc)(c)

	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Nil(t, GetTenant(c))
}

func TestTenantMiddlewareAcceptsMatchingTenantOrganization(t *testing.T) {
	svc := &mockOrgService{
		org:      &mockOrg{id: 123, slug: "test-org"},
		isMember: true,
		role:     "admin",
	}
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(http.MethodGet, "/orgs/test-org/pods", nil)
	c.Params = gin.Params{{Key: "slug", Value: "test-org"}}
	c.Set("user_id", int64(456))
	c.Set(ampOrgIDKey, int64(123))

	TenantMiddleware(svc)(c)

	tenant := GetTenant(c)
	require.NotNil(t, tenant)
	assert.Equal(t, int64(123), tenant.OrganizationID)
}

func ampToken(t *testing.T) string {
	return encodeClaims(t, map[string]any{
		"token_use": "amp_business_access",
		"iss":       "https://amp.example.com/api/v1/public/protocols/oidc/apps/ZHIYONG",
	})
}

func localToken(t *testing.T) string {
	return encodeClaims(t, map[string]any{"iss": "agentcloud", "sub": "7"})
}

func encodeClaims(t *testing.T, claims map[string]any) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	require.NoError(t, err)
	return "header." + base64.RawURLEncoding.EncodeToString(payload) + ".signature"
}
