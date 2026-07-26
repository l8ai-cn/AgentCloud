package sso

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/sso"
	"github.com/stretchr/testify/require"
)

func TestGuardOIDCAuthorizeExtraParams(t *testing.T) {
	tenant := `{"tenantId":"6"}`
	require.NoError(t, guardOIDCAuthorizeExtraParams(sso.ProtocolOIDC, true, &tenant))
	require.Error(t, guardOIDCAuthorizeExtraParams(sso.ProtocolOIDC, true, nil))
	empty := "{}"
	require.Error(t, guardOIDCAuthorizeExtraParams(sso.ProtocolOIDC, true, &empty))
	require.NoError(t, guardOIDCAuthorizeExtraParams(sso.ProtocolOIDC, false, nil))
	require.NoError(t, guardOIDCAuthorizeExtraParams(sso.ProtocolSAML, true, nil))
}
