package sso

import (
	"fmt"
	"strings"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/sso"
)

// guardOIDCAuthorizeExtraParams requires tenantId when SSO is enforced for OIDC.
// AMP rejects authorize without an explicit tenant; empty params fail closed here.
func guardOIDCAuthorizeExtraParams(protocol sso.Protocol, enforceSSO bool, raw *string) error {
	if protocol != sso.ProtocolOIDC || !enforceSSO {
		return nil
	}
	params, err := decodeAuthorizeExtraParams(raw)
	if err != nil {
		return err
	}
	if params == nil || strings.TrimSpace(params["tenantId"]) == "" {
		return fmt.Errorf("enforce_sso requires oidc_authorize_extra_params.tenantId")
	}
	return nil
}
