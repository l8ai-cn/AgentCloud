package organization

import (
	"context"
	"testing"

	orgDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSyncFederatedMember_UpdatesRole(t *testing.T) {
	svc, addUser := newTestOrgService(t)
	ctx := context.Background()

	ownerID := addUser("owner@example.com", "owner")
	org, err := svc.Create(ctx, ownerID, &CreateRequest{Name: "Fed", Slug: "fed-org"})
	require.NoError(t, err)

	memberID := addUser("member@example.com", "member")
	require.NoError(t, svc.AddMember(ctx, org.ID, memberID, orgDomain.RoleMember))
	require.NoError(t, svc.SyncFederatedMember(ctx, org.ID, memberID, orgDomain.RoleAdmin))

	role, err := svc.GetMemberRole(ctx, org.ID, memberID)
	require.NoError(t, err)
	assert.Equal(t, orgDomain.RoleAdmin, role)
}

func TestSyncFederatedMember_EmptyRolePreservesExisting(t *testing.T) {
	svc, addUser := newTestOrgService(t)
	ctx := context.Background()

	ownerID := addUser("owner@example.com", "owner")
	org, err := svc.Create(ctx, ownerID, &CreateRequest{Name: "Fed Keep", Slug: "fed-keep"})
	require.NoError(t, err)

	adminID := addUser("admin@example.com", "admin")
	require.NoError(t, svc.AddMember(ctx, org.ID, adminID, orgDomain.RoleAdmin))
	require.NoError(t, svc.SyncFederatedMember(ctx, org.ID, adminID, ""))

	role, err := svc.GetMemberRole(ctx, org.ID, adminID)
	require.NoError(t, err)
	assert.Equal(t, orgDomain.RoleAdmin, role)
}

func TestResolveAmpTenant(t *testing.T) {
	svc, addUser := newTestOrgService(t)
	ctx := context.Background()

	ownerID := addUser("owner@example.com", "owner")
	org, err := svc.Create(ctx, ownerID, &CreateRequest{Name: "AMP Bound", Slug: "amp-bound"})
	require.NoError(t, err)
	_, err = svc.Update(ctx, org.ID, map[string]interface{}{"amp_tenant_id": "6"})
	require.NoError(t, err)

	orgID, err := svc.ResolveAmpTenant(ctx, "6")
	require.NoError(t, err)
	assert.Equal(t, org.ID, orgID)

	_, err = svc.ResolveAmpTenant(ctx, "missing")
	require.ErrorIs(t, err, orgDomain.ErrNotFound)
}
