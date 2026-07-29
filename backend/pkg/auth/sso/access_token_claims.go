package sso

import "github.com/l8ai-cn/agentcloud/backend/pkg/ampauthz"

// The id_token carries identity but AMP puts roles and the authz tenant only on
// the business access_token. Signature verification is skipped here because the
// token was just issued by AMP's token endpoint inside the same TLS exchange.
func enrichUserInfoFromAccessToken(info *UserInfo, accessToken string) {
	if info == nil || accessToken == "" {
		return
	}
	claims, ok := ampauthz.DecodeBusinessToken(accessToken)
	if !ok {
		return
	}
	info.Roles = claims.RoleCodeList()
	if info.TenantID == "" {
		info.TenantID = claims.Tenant()
	}
}
