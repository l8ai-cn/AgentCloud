package ampauthz

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

// AMP mints one business JWT shape for every application it fronts. Two Agent
// Cloud surfaces read it — the SSO callback (token arrives over TLS from AMP's
// token endpoint) and the bearer authenticator (token arrives from a browser and
// must be signature-verified first). Both decode through this file so the claim
// contract has a single definition.
const (
	BusinessTokenUse         = "amp_business_access"
	PrincipalTypeUserSession = "user_session"
)

type BusinessTokenClaims struct {
	Issuer            string          `json:"iss"`
	Subject           string          `json:"sub"`
	TokenUse          string          `json:"token_use"`
	PrincipalType     string          `json:"principal_type"`
	AppCode           string          `json:"app_code"`
	TenantID          string          `json:"tenant_id"`
	AuthzTenantID     string          `json:"authz_tenant_id"`
	UserID            string          `json:"user_id"`
	Email             string          `json:"email"`
	Username          string          `json:"username"`
	PreferredUsername string          `json:"preferred_username"`
	Name              string          `json:"name"`
	RoleGrants        json.RawMessage `json:"role_grants"`
}

func (c BusinessTokenClaims) Tenant() string {
	if tenant := strings.TrimSpace(c.AuthzTenantID); tenant != "" {
		return tenant
	}
	return strings.TrimSpace(c.TenantID)
}

// RoleCodeList returns the application-local role codes carried by the token.
// AMP emits roles only as `role_grants` on user_session tokens, shaped
// `[{"roleKey":"<APP_CODE>/<ROLE>","scope":{…}}]`, and validates at issue time
// that every grant belongs to the token's own tenant and app. Grants outside the
// token's app namespace are dropped rather than reinterpreted: an out-of-scope
// grant must never widen access.
func (c BusinessTokenClaims) RoleCodeList() []string {
	if len(c.RoleGrants) == 0 || string(c.RoleGrants) == "null" {
		return nil
	}
	var grants []struct {
		RoleKey string `json:"roleKey"`
	}
	if err := json.Unmarshal(c.RoleGrants, &grants); err != nil {
		return nil
	}
	appCode := strings.TrimSpace(c.AppCode)
	if appCode == "" {
		return nil
	}
	prefix := appCode + "/"
	out := make([]string, 0, len(grants))
	for _, grant := range grants {
		key := strings.TrimSpace(grant.RoleKey)
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		if code := key[len(prefix):]; code != "" {
			out = append(out, code)
		}
	}
	return out
}

func (c BusinessTokenClaims) DisplayName() string {
	for _, candidate := range []string{c.Username, c.PreferredUsername, c.Name, c.UserID} {
		if trimmed := strings.TrimSpace(candidate); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// DecodeBusinessToken reads the payload without verifying the signature. Callers
// that did not receive the token directly from AMP must verify it separately
// before trusting any field.
func DecodeBusinessToken(token string) (BusinessTokenClaims, bool) {
	var claims BusinessTokenClaims
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return claims, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		payload, err = base64.URLEncoding.DecodeString(parts[1])
		if err != nil {
			return claims, false
		}
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return claims, false
	}
	return claims, true
}

