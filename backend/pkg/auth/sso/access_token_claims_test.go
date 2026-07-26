package sso

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnrichUserInfoFromAccessToken(t *testing.T) {
	payload, err := json.Marshal(map[string]any{
		"roles":           []string{"ORG_ADMIN", "VIEWER"},
		"authz_tenant_id": "6",
		"tenant_id":       "6",
	})
	require.NoError(t, err)
	token := "hdr." + base64.RawURLEncoding.EncodeToString(payload) + ".sig"

	info := &UserInfo{ExternalID: "principal:x"}
	enrichUserInfoFromAccessToken(info, token)
	assert.Equal(t, "6", info.TenantID)
	assert.Equal(t, []string{"ORG_ADMIN", "VIEWER"}, info.Roles)
}

func TestEnrichUserInfoFromAccessToken_PreservesIDTokenTenant(t *testing.T) {
	payload, err := json.Marshal(map[string]any{
		"roles":           []string{"APP_ADMIN"},
		"authz_tenant_id": "99",
	})
	require.NoError(t, err)
	token := "hdr." + base64.RawURLEncoding.EncodeToString(payload) + ".sig"

	info := &UserInfo{TenantID: "6"}
	enrichUserInfoFromAccessToken(info, token)
	assert.Equal(t, "6", info.TenantID)
	assert.Equal(t, []string{"APP_ADMIN"}, info.Roles)
}

func TestEnrichUserInfoFromAccessToken_RoleObjectsAndSingular(t *testing.T) {
	payload, err := json.Marshal(map[string]any{
		"roles": []map[string]string{{"code": "ORG_OWNER"}},
	})
	require.NoError(t, err)
	info := &UserInfo{}
	enrichUserInfoFromAccessToken(info, "hdr."+base64.RawURLEncoding.EncodeToString(payload)+".sig")
	assert.Equal(t, []string{"ORG_OWNER"}, info.Roles)

	payload, err = json.Marshal(map[string]any{"role": "OPERATOR"})
	require.NoError(t, err)
	info = &UserInfo{}
	enrichUserInfoFromAccessToken(info, "hdr."+base64.RawURLEncoding.EncodeToString(payload)+".sig")
	assert.Equal(t, []string{"OPERATOR"}, info.Roles)
}
