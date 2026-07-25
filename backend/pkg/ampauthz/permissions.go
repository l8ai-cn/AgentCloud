package ampauthz

import "github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"

// Permission codes — keep in sync with authz/permissions.yaml (embedded SSOT).
const (
	PermOrgSettingsWrite = "agentscloud:org:settings:write"
	PermMemberInvite     = "agentscloud:member:invite"
	PermRunnerManage     = "agentscloud:runner:manage"
	PermBillingManage    = "agentscloud:billing:manage"
	PermRepoManage       = "agentscloud:repo:manage"
	PermAIResourceManage = "agentscloud:ai_resource:manage"
	PermPodUse           = "agentscloud:pod:use"
	PermTicketUse        = "agentscloud:ticket:use"
)

var requiredPermissionConsts = []string{
	PermOrgSettingsWrite, PermMemberInvite, PermRunnerManage, PermBillingManage,
	PermRepoManage, PermAIResourceManage, PermPodUse, PermTicketUse,
}

// PermissionsForRole returns the local execution-plane permission set for an
// AgentCloud org role (derived from the embedded authz bundle).
func PermissionsForRole(role string) []string {
	loadCatalog()
	if catalogErr != nil {
		return fallbackPermissions(role)
	}
	if perms, ok := permByRole[role]; ok {
		return append([]string(nil), perms...)
	}
	return append([]string(nil), permByRole[organization.RoleMember]...)
}

// RoleHasPermission reports whether the org role grants perm.
func RoleHasPermission(role, perm string) bool {
	for _, p := range PermissionsForRole(role) {
		if p == perm {
			return true
		}
	}
	return false
}

func fallbackPermissions(role string) []string {
	switch role {
	case organization.RoleOwner:
		return append([]string(nil), requiredPermissionConsts...)
	case organization.RoleAdmin:
		return []string{
			PermOrgSettingsWrite, PermMemberInvite, PermRunnerManage,
			PermRepoManage, PermAIResourceManage, PermPodUse, PermTicketUse,
		}
	default:
		return []string{PermPodUse, PermTicketUse}
	}
}
