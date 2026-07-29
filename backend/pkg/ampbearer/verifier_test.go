package ampbearer_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/pkg/ampbearer"
)

func TestVerifyAcceptsSignedBusinessToken(t *testing.T) {
	idp := newTestIdP(t)
	token := idp.sign(t, validClaims())

	claims, err := ampbearer.NewVerifier().Verify(context.Background(), idp.issuer, token)
	require.NoError(t, err)
	assert.Equal(t, "principal:union-1", claims.Subject)
	assert.Equal(t, "ZHIYONG", claims.AppCode)
	assert.Equal(t, "6", claims.Tenant())
	assert.Equal(t, []string{"APP_USER"}, claims.RoleCodeList())
}

func TestVerifyRejectsForeignSignature(t *testing.T) {
	idp := newTestIdP(t)
	token := idp.signWithForeignKey(t, validClaims())

	_, err := ampbearer.NewVerifier().Verify(context.Background(), idp.issuer, token)
	require.Error(t, err)
	assert.ErrorIs(t, err, ampbearer.ErrSignature)
}

func TestVerifyRejectsExpiredToken(t *testing.T) {
	idp := newTestIdP(t)
	claims := validClaims()
	claims["exp"] = time.Now().Add(-time.Minute).Unix()

	_, err := ampbearer.NewVerifier().Verify(context.Background(), idp.issuer, idp.sign(t, claims))
	assert.ErrorIs(t, err, ampbearer.ErrSignature)
}

func TestVerifyRejectsIncompleteIdentity(t *testing.T) {
	idp := newTestIdP(t)
	verifier := ampbearer.NewVerifier()

	cases := map[string]func(map[string]any){
		"machine principal": func(c map[string]any) { c["principal_type"] = "api_key" },
		"missing subject":   func(c map[string]any) { delete(c, "sub") },
		"missing app code":  func(c map[string]any) { delete(c, "app_code") },
		"missing tenant": func(c map[string]any) {
			delete(c, "tenant_id")
			delete(c, "authz_tenant_id")
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			claims := validClaims()
			mutate(claims)
			_, err := verifier.Verify(context.Background(), idp.issuer, idp.sign(t, claims))
			assert.ErrorIs(t, err, ampbearer.ErrClaimsIncomplete)
		})
	}
}

func TestVerifyRejectsNonBusinessTokenUse(t *testing.T) {
	idp := newTestIdP(t)
	claims := validClaims()
	claims["token_use"] = "amp_id"

	_, err := ampbearer.NewVerifier().Verify(context.Background(), idp.issuer, idp.sign(t, claims))
	assert.ErrorIs(t, err, ampbearer.ErrNotBusinessToken)
}

func TestVerifyRejectsAnotherIssuersToken(t *testing.T) {
	issuing := newTestIdP(t)
	expected := newTestIdP(t)

	_, err := ampbearer.NewVerifier().Verify(
		context.Background(), expected.issuer, issuing.sign(t, validClaims()),
	)
	assert.ErrorIs(t, err, ampbearer.ErrSignature)
}

func TestPeekIssuerDoesNotTrustNonAMPTokens(t *testing.T) {
	_, err := ampbearer.PeekIssuer(unsignedToken(t, map[string]any{"iss": "agentcloud"}))
	assert.ErrorIs(t, err, ampbearer.ErrNotBusinessToken)
}
