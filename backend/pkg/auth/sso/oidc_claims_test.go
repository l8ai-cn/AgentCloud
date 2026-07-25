package sso

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserInfoFromClaims_RequiresSub(t *testing.T) {
	_, err := userInfoFromClaims(idTokenClaims{Email: "user@example.com"})
	require.ErrorIs(t, err, ErrAuthFailed)
}

func TestUserInfoFromClaims_EmailOptional(t *testing.T) {
	info, err := userInfoFromClaims(idTokenClaims{
		Sub:      "principal:u-1",
		Name:     "Student One",
		Username: "student-one",
		TenantID: "tenant-9",
	})
	require.NoError(t, err)
	assert.Equal(t, "principal:u-1", info.ExternalID)
	assert.Empty(t, info.Email)
	assert.False(t, info.EmailVerified)
	assert.Equal(t, "tenant-9", info.TenantID)
}

func TestUserInfoFromClaims_EmailVerifiedVariants(t *testing.T) {
	cases := []struct {
		name  string
		claim any
		want  bool
	}{
		{"bool true", true, true},
		{"bool false", false, false},
		{"string true", "true", true},
		{"string false", "false", false},
		{"string garbage", "yes", false},
		{"number one", float64(1), true},
		{"number zero", float64(0), false},
		{"absent", nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info, err := userInfoFromClaims(idTokenClaims{
				Sub:           "principal:u-1",
				Email:         "user@example.com",
				EmailVerified: tc.claim,
			})
			require.NoError(t, err)
			assert.Equal(t, tc.want, info.EmailVerified)
		})
	}
}

// A verified flag without an address must not be trusted: account merging keys
// off the email, so an empty one would collide across users.
func TestUserInfoFromClaims_VerifiedWithoutEmailIsNotVerified(t *testing.T) {
	info, err := userInfoFromClaims(idTokenClaims{Sub: "principal:u-1", EmailVerified: true})
	require.NoError(t, err)
	assert.False(t, info.EmailVerified)
}
