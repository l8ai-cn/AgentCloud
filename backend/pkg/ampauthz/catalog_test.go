package ampauthz

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCatalogLoadsFromEmbed(t *testing.T) {
	require.NoError(t, CatalogError())
	for _, code := range requiredPermissionConsts {
		_, ok := knownPerms[code]
		assert.Truef(t, ok, "permissions.yaml missing const %s", code)
	}
	assert.Contains(t, PermissionsForRole(organization.RoleOwner), PermBillingManage)
	assert.NotContains(t, PermissionsForRole(organization.RoleAdmin), PermBillingManage)
	assert.Contains(t, PermissionsForRole(organization.RoleMember), PermPodUse)
}

func TestAuthzBundleFilesPresent(t *testing.T) {
	for _, name := range []string{
		"authz/permissions.yaml",
		"authz/roles.yaml",
		"authz/features.yaml",
		"authz/menus.yaml",
		"authz/workspace.yaml",
	} {
		_, err := authzFS.ReadFile(name)
		require.NoError(t, err, name)
	}
}
