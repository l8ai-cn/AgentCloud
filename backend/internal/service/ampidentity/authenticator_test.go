package ampidentity

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	ssodomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/sso"
	userdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/user"
	authsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/auth"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampauthz"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampbearer"
)

const (
	testIssuer     = "https://amp.example.com/api/v1/public/protocols/oidc/apps/ZHIYONG"
	testIssuerBase = "https://amp.example.com/api/v1/public/protocols/oidc/apps/"
)

type stubConfigLister struct {
	configs      []*ssodomain.Config
	err          error
	seenPrefixes []string
}

func (s *stubConfigLister) ListAMPBearerByIssuerPrefix(
	_ context.Context,
	issuerPrefix string,
) ([]*ssodomain.Config, error) {
	s.seenPrefixes = append(s.seenPrefixes, issuerPrefix)
	return s.configs, s.err
}

type stubFederator struct {
	user    *userdomain.User
	orgID   int64
	err     error
	request *authsvc.SSOLoginRequest
}

func (s *stubFederator) FederateIdentity(
	_ context.Context,
	req *authsvc.SSOLoginRequest,
) (*userdomain.User, int64, error) {
	s.request = req
	if s.err != nil {
		return nil, 0, s.err
	}
	return s.user, s.orgID, nil
}

type stubVerifier struct {
	claims ampauthz.BusinessTokenClaims
	err    error
	called bool
}

func (s *stubVerifier) Verify(
	_ context.Context,
	_ string,
	_ string,
) (ampauthz.BusinessTokenClaims, error) {
	s.called = true
	return s.claims, s.err
}

func TestAuthenticateFederatesVerifiedIdentity(t *testing.T) {
	configs := &stubConfigLister{configs: []*ssodomain.Config{ampConfig(42, `["ZHIYONG"]`)}}
	federator := &stubFederator{
		user:  &userdomain.User{ID: 7, Email: "student@example.com", Username: "student"},
		orgID: 2,
	}
	verifier := &stubVerifier{claims: verifiedClaims()}

	identity, err := NewAuthenticator(configs, federator, verifier).
		Authenticate(context.Background(), businessToken(t))

	require.NoError(t, err)
	assert.Equal(t, int64(7), identity.UserID)
	assert.Equal(t, int64(2), identity.OrganizationID)
	assert.Equal(t, "6", identity.TenantID)
	assert.Equal(t, "ZHIYONG", identity.AppCode)
	assert.Equal(t, []string{testIssuerBase}, configs.seenPrefixes)
	assert.Equal(t, "sso_oidc_42", federator.request.ProviderName)
	assert.Equal(t, "principal:union-1", federator.request.ExternalID)
	assert.Equal(t, []string{"APP_ADMIN"}, federator.request.IdPRoles)
}

func TestAuthenticateRejectsUnconfiguredIssuerBeforeVerifying(t *testing.T) {
	verifier := &stubVerifier{claims: verifiedClaims()}
	_, err := NewAuthenticator(&stubConfigLister{}, &stubFederator{}, verifier).
		Authenticate(context.Background(), businessToken(t))

	assert.ErrorIs(t, err, ErrIssuerNotConfigured)
	assert.False(t, verifier.called, "an unconfigured issuer must never be contacted")
}

func TestAuthenticateRejectsAppCodeOutsideWhitelist(t *testing.T) {
	configs := &stubConfigLister{configs: []*ssodomain.Config{ampConfig(42, `["OTHERAPP"]`)}}
	verifier := &stubVerifier{claims: verifiedClaims()}

	_, err := NewAuthenticator(configs, &stubFederator{}, verifier).
		Authenticate(context.Background(), businessToken(t))

	assert.ErrorIs(t, err, ErrAppCodeNotAllowed)
	assert.False(t, verifier.called)
}

func TestAuthenticateRejectsMalformedWhitelist(t *testing.T) {
	configs := &stubConfigLister{configs: []*ssodomain.Config{ampConfig(42, `{"ZHIYONG":true}`)}}

	_, err := NewAuthenticator(configs, &stubFederator{}, &stubVerifier{claims: verifiedClaims()}).
		Authenticate(context.Background(), businessToken(t))

	assert.ErrorIs(t, err, ErrAppCodeNotAllowed)
}

func TestAuthenticateRejectsAmbiguousConfiguration(t *testing.T) {
	configs := &stubConfigLister{configs: []*ssodomain.Config{
		ampConfig(42, `["ZHIYONG"]`),
		ampConfig(43, `["ZHIYONG"]`),
	}}

	_, err := NewAuthenticator(configs, &stubFederator{}, &stubVerifier{claims: verifiedClaims()}).
		Authenticate(context.Background(), businessToken(t))

	assert.ErrorIs(t, err, ErrAmbiguousConfig)
}

func TestAuthenticateRejectsAppCodeThatDisagreesWithIssuer(t *testing.T) {
	configs := &stubConfigLister{configs: []*ssodomain.Config{ampConfig(42, `["ZHIYONG"]`)}}
	claims := verifiedClaims()
	claims.AppCode = "SOMETHINGELSE"

	_, err := NewAuthenticator(configs, &stubFederator{}, &stubVerifier{claims: claims}).
		Authenticate(context.Background(), businessToken(t))

	assert.ErrorIs(t, err, ErrAppCodeNotAllowed)
}

func TestAuthenticateRejectsTenantWithoutOrganization(t *testing.T) {
	configs := &stubConfigLister{configs: []*ssodomain.Config{ampConfig(42, `["ZHIYONG"]`)}}
	federator := &stubFederator{user: &userdomain.User{ID: 7}, orgID: 0}

	_, err := NewAuthenticator(configs, federator, &stubVerifier{claims: verifiedClaims()}).
		Authenticate(context.Background(), businessToken(t))

	assert.ErrorIs(t, err, ErrOrganizationUnbound)
}

func TestAuthenticatePropagatesVerificationFailure(t *testing.T) {
	configs := &stubConfigLister{configs: []*ssodomain.Config{ampConfig(42, `["ZHIYONG"]`)}}
	verifier := &stubVerifier{err: ampbearer.ErrSignature}

	_, err := NewAuthenticator(configs, &stubFederator{}, verifier).
		Authenticate(context.Background(), businessToken(t))

	assert.ErrorIs(t, err, ampbearer.ErrSignature)
}

func TestAuthenticateRejectsNonAMPCredential(t *testing.T) {
	_, err := NewAuthenticator(&stubConfigLister{}, &stubFederator{}, &stubVerifier{}).
		Authenticate(context.Background(), token(t, map[string]any{"iss": "agentcloud"}))

	assert.ErrorIs(t, err, ampbearer.ErrNotBusinessToken)
}

func TestAuthenticateSurfacesConfigLookupFailure(t *testing.T) {
	configs := &stubConfigLister{err: errors.New("database unavailable")}

	_, err := NewAuthenticator(configs, &stubFederator{}, &stubVerifier{}).
		Authenticate(context.Background(), businessToken(t))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "database unavailable")
}

func ampConfig(id int64, appCodes string) *ssodomain.Config {
	issuer := testIssuer
	orgID := int64(2)
	return &ssodomain.Config{
		ID:                    id,
		Protocol:              ssodomain.ProtocolOIDC,
		IsEnabled:             true,
		OIDCIssuerURL:         &issuer,
		DefaultOrganizationID: &orgID,
		AMPBearerAppCodes:     &appCodes,
	}
}

func verifiedClaims() ampauthz.BusinessTokenClaims {
	return ampauthz.BusinessTokenClaims{
		Issuer:        testIssuer,
		Subject:       "principal:union-1",
		TokenUse:      ampauthz.BusinessTokenUse,
		PrincipalType: ampauthz.PrincipalTypeUserSession,
		AppCode:       "ZHIYONG",
		TenantID:      "6",
		Roles:         json.RawMessage(`["APP_ADMIN"]`),
	}
}

func businessToken(t *testing.T) string {
	return token(t, map[string]any{
		"token_use": ampauthz.BusinessTokenUse,
		"iss":       testIssuer,
	})
}

func token(t *testing.T, claims map[string]any) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	require.NoError(t, err)
	return "header." + base64.RawURLEncoding.EncodeToString(payload) + ".signature"
}
