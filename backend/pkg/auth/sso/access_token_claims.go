package sso

import (
	"encoding/base64"
	"encoding/json"
	"strings"
)

// ampAccessTokenClaims are the authz-relevant fields on AMP's business JWT
// (OAuth access_token). Parsed without signature verify because the token was
// just issued by AMP's token endpoint in the same TLS exchange.
type ampAccessTokenClaims struct {
	Roles           json.RawMessage `json:"roles"`
	Role            string          `json:"role"`
	RoleCodes       json.RawMessage `json:"role_codes"`
	TenantID        string          `json:"tenant_id"`
	AuthzTenantID   string          `json:"authz_tenant_id"`
	PermissionCodes []string        `json:"permissions"`
}

func enrichUserInfoFromAccessToken(info *UserInfo, accessToken string) {
	if info == nil || accessToken == "" {
		return
	}
	claims, ok := parseJWTPayload(accessToken)
	if !ok {
		return
	}
	if len(info.Roles) == 0 {
		if roles := extractRoleCodes(claims); len(roles) > 0 {
			info.Roles = roles
		}
	}
	if info.TenantID == "" {
		if claims.AuthzTenantID != "" {
			info.TenantID = claims.AuthzTenantID
		} else if claims.TenantID != "" {
			info.TenantID = claims.TenantID
		}
	}
}

func extractRoleCodes(claims ampAccessTokenClaims) []string {
	out := decodeRoleList(claims.Roles)
	if len(out) == 0 {
		out = decodeRoleList(claims.RoleCodes)
	}
	if len(out) == 0 && strings.TrimSpace(claims.Role) != "" {
		out = []string{strings.TrimSpace(claims.Role)}
	}
	return out
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
		single = strings.TrimSpace(single)
		if single != "" {
			return []string{single}
		}
	}
	return nil
}

func trimNonEmpty(in []string) []string {
	out := make([]string, 0, len(in))
	for _, v := range in {
		if s := strings.TrimSpace(v); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func parseJWTPayload(token string) (ampAccessTokenClaims, bool) {
	var claims ampAccessTokenClaims
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
