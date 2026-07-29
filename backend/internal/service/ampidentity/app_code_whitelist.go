package ampidentity

import (
	"encoding/json"
	"strings"

	ssodomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/sso"
)

// The whitelist is stored as a JSON array so operators can grant and revoke
// per-application trust from the existing SSO config surface. A config that
// cannot be parsed grants nothing — a malformed whitelist must never widen trust.
func allowsAppCode(config *ssodomain.Config, appCode string) bool {
	if config == nil || config.AMPBearerAppCodes == nil {
		return false
	}
	wanted := strings.TrimSpace(appCode)
	if wanted == "" {
		return false
	}
	var allowed []string
	if err := json.Unmarshal([]byte(*config.AMPBearerAppCodes), &allowed); err != nil {
		return false
	}
	for _, candidate := range allowed {
		if strings.EqualFold(strings.TrimSpace(candidate), wanted) {
			return true
		}
	}
	return false
}
