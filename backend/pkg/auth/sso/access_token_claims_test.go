package sso

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func businessAccessToken(t *testing.T, claims map[string]any) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	require.NoError(t, err)
	return "hdr." + base64.RawURLEncoding.EncodeToString(payload) + ".sig"
}

func roleGrant(roleKey, tenantID, appCode string) map[string]any {
	return map[string]any{
		"roleKey": roleKey,
		"scope": map[string]any{
			"type": "TENANT_APP", "tenantId": tenantID, "appCode": appCode,
		},
	}
}

func TestEnrichUserInfoFromAccessToken(t *testing.T) {
	token := businessAccessToken(t, map[string]any{
		"app_code":        "AGENTCLOUD",
		"authz_tenant_id": "6",
		"tenant_id":       "6",
		"role_grants": []map[string]any{
			roleGrant("AGENTCLOUD/ORG_ADMIN", "6", "AGENTCLOUD"),
			roleGrant("AGENTCLOUD/VIEWER", "6", "AGENTCLOUD"),
		},
	})

	info := &UserInfo{ExternalID: "principal:x"}
	enrichUserInfoFromAccessToken(info, token)

	assert.Equal(t, "6", info.TenantID)
	assert.Equal(t, []string{"ORG_ADMIN", "VIEWER"}, info.Roles)
}

func TestEnrichUserInfoFromAccessToken_PreservesIDTokenTenant(t *testing.T) {
	token := businessAccessToken(t, map[string]any{
		"app_code":        "AGENTCLOUD",
		"authz_tenant_id": "99",
		"role_grants": []map[string]any{
			roleGrant("AGENTCLOUD/APP_ADMIN", "99", "AGENTCLOUD"),
		},
	})

	info := &UserInfo{TenantID: "6"}
	enrichUserInfoFromAccessToken(info, token)

	assert.Equal(t, "6", info.TenantID)
	assert.Equal(t, []string{"APP_ADMIN"}, info.Roles)
}

// A grant minted for another application must not be read as a local role.
func TestEnrichUserInfoFromAccessToken_DropsForeignAppGrants(t *testing.T) {
	token := businessAccessToken(t, map[string]any{
		"app_code": "AGENTCLOUD",
		"role_grants": []map[string]any{
			roleGrant("ZHIYONG/APP_ADMIN", "6", "ZHIYONG"),
			roleGrant("AGENTCLOUD/ORG_MEMBER", "6", "AGENTCLOUD"),
		},
	})

	info := &UserInfo{}
	enrichUserInfoFromAccessToken(info, token)

	assert.Equal(t, []string{"ORG_MEMBER"}, info.Roles)
}

// AMP omits role_grants entirely when the principal holds no grants. That is a
// revocation signal, not a reason to keep a previously asserted role.
func TestEnrichUserInfoFromAccessToken_NoGrantsYieldsNoRoles(t *testing.T) {
	token := businessAccessToken(t, map[string]any{
		"app_code":  "AGENTCLOUD",
		"tenant_id": "6",
	})

	info := &UserInfo{Roles: []string{"ORG_OWNER"}}
	enrichUserInfoFromAccessToken(info, token)

	assert.Empty(t, info.Roles)
}
