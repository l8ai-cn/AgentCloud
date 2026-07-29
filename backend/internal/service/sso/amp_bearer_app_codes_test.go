package sso

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newAMPBearerCreateRequest(appCodes string) *CreateConfigRequest {
	return &CreateConfigRequest{
		Domain:            "amp.example.com",
		Name:              "AMP SSO",
		Protocol:          "oidc",
		OIDCIssuerURL:     "https://amp.example.com/oidc/apps/ZHIYONG",
		OIDCClientID:      "agentcloud",
		AMPBearerAppCodes: appCodes,
	}
}

func TestCreateConfig_AMPBearerAppCodes_Stored(t *testing.T) {
	repo := newMockRepository()
	svc := newTestService(repo)

	cfg, err := svc.CreateConfig(context.Background(), newAMPBearerCreateRequest(`["ZHIYONG","AGENTCLOUD"]`), 1)
	require.NoError(t, err)
	require.NotNil(t, cfg.AMPBearerAppCodes)
	assert.JSONEq(t, `["ZHIYONG","AGENTCLOUD"]`, *cfg.AMPBearerAppCodes)

	resp := svc.ToConfigResponse(cfg)
	assert.JSONEq(t, `["ZHIYONG","AGENTCLOUD"]`, resp.AMPBearerAppCodes)
}

func TestCreateConfig_AMPBearerAppCodes_RejectsMalformed(t *testing.T) {
	repo := newMockRepository()
	svc := newTestService(repo)

	_, err := svc.CreateConfig(context.Background(), newAMPBearerCreateRequest(`ZHIYONG`), 1)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "amp_bearer_app_codes")
}

func TestCreateConfig_AMPBearerAppCodes_RejectsBlankEntry(t *testing.T) {
	repo := newMockRepository()
	svc := newTestService(repo)

	_, err := svc.CreateConfig(context.Background(), newAMPBearerCreateRequest(`["ZHIYONG","  "]`), 1)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "empty app codes")
}

func TestBuildUpdateMap_AMPBearerAppCodes_SetAndClear(t *testing.T) {
	svc := newTestService(newMockRepository())

	appCodes := `["ZHIYONG"]`
	updates, err := svc.buildUpdateMap(&UpdateConfigRequest{AMPBearerAppCodes: &appCodes})
	require.NoError(t, err)
	assert.Equal(t, appCodes, updates["amp_bearer_app_codes"])

	cleared := ""
	updates, err = svc.buildUpdateMap(&UpdateConfigRequest{AMPBearerAppCodes: &cleared})
	require.NoError(t, err)
	assert.Equal(t, emptyJSONArray, updates["amp_bearer_app_codes"])
}

func TestBuildUpdateMap_AMPBearerAppCodes_RejectsMalformed(t *testing.T) {
	svc := newTestService(newMockRepository())

	bad := `{"app":"ZHIYONG"}`
	_, err := svc.buildUpdateMap(&UpdateConfigRequest{AMPBearerAppCodes: &bad})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "amp_bearer_app_codes")
}
