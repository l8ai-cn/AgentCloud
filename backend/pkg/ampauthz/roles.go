package ampauthz

import (
	"strings"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
)

// MapIdPRoles picks the highest AgentCloud org role implied by AMP role codes.
// Unknown / empty IdP roles fall back to member (safe default for JIT).
func MapIdPRoles(idpRoles []string) string {
	best := organization.RoleMember
	for _, raw := range idpRoles {
		role := normalizeRoleCode(raw)
		mapped := mapOne(role)
		if rank(mapped) > rank(best) {
			best = mapped
		}
	}
	return best
}

func normalizeRoleCode(role string) string {
	return strings.ToUpper(strings.TrimSpace(role))
}

func mapOne(role string) string {
	switch role {
	case "ORG_OWNER", "APP_ADMIN", "OWNER", "TENANT_OWNER":
		return organization.RoleOwner
	case "ORG_ADMIN", "OPERATOR", "ADMIN", "TENANT_ADMIN":
		return organization.RoleAdmin
	case "ORG_MEMBER", "VIEWER", "MEMBER", "USER":
		return organization.RoleMember
	default:
		return organization.RoleMember
	}
}

func rank(role string) int {
	switch role {
	case organization.RoleOwner:
		return 3
	case organization.RoleAdmin:
		return 2
	case organization.RoleMember:
		return 1
	default:
		return 0
	}
}
