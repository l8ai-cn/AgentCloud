package ampbearer_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/pkg/ampbearer"
)

func TestSplitIssuerSeparatesDeploymentFromApp(t *testing.T) {
	base, appCode, err := ampbearer.SplitIssuer(
		"https://amp.example.com/api/v1/public/protocols/oidc/apps/ZHIYONG",
	)
	require.NoError(t, err)
	assert.Equal(t, "https://amp.example.com/api/v1/public/protocols/oidc/apps/", base)
	assert.Equal(t, "ZHIYONG", appCode)
}

func TestSplitIssuerTreatsTrailingSlashAsSame(t *testing.T) {
	withSlash, appCode, err := ampbearer.SplitIssuer(
		"https://amp.example.com/api/v1/public/protocols/oidc/apps/AGENTCLOUD/",
	)
	require.NoError(t, err)
	assert.Equal(t, "AGENTCLOUD", appCode)

	withoutSlash, _, err := ampbearer.SplitIssuer(
		"https://amp.example.com/api/v1/public/protocols/oidc/apps/OTHER",
	)
	require.NoError(t, err)
	assert.Equal(t, withoutSlash, withSlash)
}

func TestSplitIssuerRejectsNonAMPShapes(t *testing.T) {
	for name, issuer := range map[string]string{
		"empty":            "",
		"no apps segment":  "https://amp.example.com/realms/master",
		"missing app code": "https://amp.example.com/api/v1/public/protocols/oidc/apps/",
		"not a url":        "::::",
		"wrong scheme":     "ftp://amp.example.com/oidc/apps/ZHIYONG",
		"has query":        "https://amp.example.com/oidc/apps/ZHIYONG?x=1",
		"has credentials":  "https://user:pw@amp.example.com/oidc/apps/ZHIYONG",
	} {
		t.Run(name, func(t *testing.T) {
			_, _, err := ampbearer.SplitIssuer(issuer)
			assert.Error(t, err)
		})
	}
}

func TestIsBusinessTokenRoutesOnlyAMPCredentials(t *testing.T) {
	amp := unsignedToken(t, map[string]any{
		"token_use": "amp_business_access",
		"iss":       "https://amp.example.com/oidc/apps/ZHIYONG",
	})
	assert.True(t, ampbearer.IsBusinessToken(amp))

	local := unsignedToken(t, map[string]any{"iss": "agentcloud"})
	assert.False(t, ampbearer.IsBusinessToken(local))
	assert.False(t, ampbearer.IsBusinessToken("not-a-jwt"))

	issuerless := unsignedToken(t, map[string]any{"token_use": "amp_business_access"})
	assert.False(t, ampbearer.IsBusinessToken(issuerless))
}
