package ampauthz

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/stretchr/testify/assert"
)

func TestMapIdPRoles(t *testing.T) {
	assert.Equal(t, organization.RoleMember, MapIdPRoles(nil))
	assert.Equal(t, organization.RoleMember, MapIdPRoles([]string{"VIEWER"}))
	assert.Equal(t, organization.RoleAdmin, MapIdPRoles([]string{"OPERATOR"}))
	assert.Equal(t, organization.RoleOwner, MapIdPRoles([]string{"APP_ADMIN"}))
	assert.Equal(t, organization.RoleOwner, MapIdPRoles([]string{"VIEWER", "ORG_OWNER"}))
	assert.Equal(t, organization.RoleAdmin, MapIdPRoles([]string{"member", "ORG_ADMIN"}))
}

func TestRoleHasPermission(t *testing.T) {
	assert.True(t, RoleHasPermission(organization.RoleOwner, PermBillingManage))
	assert.False(t, RoleHasPermission(organization.RoleAdmin, PermBillingManage))
	assert.True(t, RoleHasPermission(organization.RoleAdmin, PermRunnerManage))
	assert.False(t, RoleHasPermission(organization.RoleMember, PermRunnerManage))
	assert.True(t, RoleHasPermission(organization.RoleMember, PermPodUse))
}
