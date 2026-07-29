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
	Role              string          `json:"role"`
	Roles             json.RawMessage `json:"roles"`
	RoleCodes         json.RawMessage `json:"role_codes"`
	PermissionCodes   []string        `json:"permissions"`
}

func (c BusinessTokenClaims) Tenant() string {
	if tenant := strings.TrimSpace(c.AuthzTenantID); tenant != "" {
		return tenant
	}
	return strings.TrimSpace(c.TenantID)
}

func (c BusinessTokenClaims) RoleCodeList() []string {
	out := decodeRoleList(c.Roles)
	if len(out) == 0 {
		out = decodeRoleList(c.RoleCodes)
	}
	if len(out) == 0 && strings.TrimSpace(c.Role) != "" {
		out = []string{strings.TrimSpace(c.Role)}
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

func decodeRoleList(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var asStrings []string
	if err := json.Unmarshal(raw, &asStrings); err == nil {
		return trimNonEmpty(asStrings)
	}
	var asObjects []struct {
		Code string `json:"code"`
		Role string `json:"role"`
	}
	if err := json.Unmarshal(raw, &asObjects); err == nil {
		out := make([]string, 0, len(asObjects))
		for _, item := range asObjects {
			code := strings.TrimSpace(item.Code)
			if code == "" {
				code = strings.TrimSpace(item.Role)
			}
			if code != "" {
				out = append(out, code)
			}
		}
		return out
	}
	var single string
	if err := json.Unmarshal(raw, &single); err == nil {
		if single = strings.TrimSpace(single); single != "" {
			return []string{single}
		}
	}
	return nil
}

func trimNonEmpty(in []string) []string {
	out := make([]string, 0, len(in))
	for _, value := range in {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
