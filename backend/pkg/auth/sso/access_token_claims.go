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
	Roles           []string `json:"roles"`
	TenantID        string   `json:"tenant_id"`
	AuthzTenantID   string   `json:"authz_tenant_id"`
	PermissionCodes []string `json:"permissions"`
}

func enrichUserInfoFromAccessToken(info *UserInfo, accessToken string) {
	if info == nil || accessToken == "" {
		return
	}
	claims, ok := parseJWTPayload(accessToken)
	if !ok {
		return
	}
	if len(info.Roles) == 0 && len(claims.Roles) > 0 {
		info.Roles = append([]string(nil), claims.Roles...)
	}
	if info.TenantID == "" {
		if claims.AuthzTenantID != "" {
			info.TenantID = claims.AuthzTenantID
		} else if claims.TenantID != "" {
			info.TenantID = claims.TenantID
		}
	}
}

func parseJWTPayload(token string) (ampAccessTokenClaims, bool) {
	var claims ampAccessTokenClaims
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return claims, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		// Some issuers pad; try standard encoding as fallback.
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
