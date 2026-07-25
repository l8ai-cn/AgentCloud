package organization

import (
	"context"
	"testing"

	orgDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnsureMember_AddsThenStaysIdempotent(t *testing.T) {
	svc, addUser := newTestOrgService(t)
	ctx := context.Background()

	ownerID := addUser("owner@example.com", "owner")
	org, err := svc.Create(ctx, ownerID, &CreateRequest{Name: "Zhiyong", Slug: "zhiyong"})
	require.NoError(t, err)

	federatedID := addUser("federated@example.com", "federated")
	require.NoError(t, svc.EnsureMember(ctx, org.ID, federatedID, orgDomain.RoleMember))
	require.NoError(t, svc.EnsureMember(ctx, org.ID, federatedID, orgDomain.RoleMember))

	members, err := svc.ListMembers(ctx, org.ID)
	require.NoError(t, err)
	assert.Len(t, members, 2)
}

// Re-login must not demote someone who was promoted inside AgentCloud: AMP
// owns authentication, AgentCloud owns in-org roles.
func TestEnsureMember_KeepsExistingRole(t *testing.T) {
	svc, addUser := newTestOrgService(t)
	ctx := context.Background()

	ownerID := addUser("owner@example.com", "owner")
	org, err := svc.Create(ctx, ownerID, &CreateRequest{Name: "Zhiyong", Slug: "zhiyong"})
	require.NoError(t, err)

	adminID := addUser("admin@example.com", "admin")
	require.NoError(t, svc.AddMember(ctx, org.ID, adminID, orgDomain.RoleAdmin))
	require.NoError(t, svc.EnsureMember(ctx, org.ID, adminID, orgDomain.RoleMember))

	member, err := svc.GetMember(ctx, org.ID, adminID)
	require.NoError(t, err)
	assert.Equal(t, orgDomain.RoleAdmin, member.Role)
}

func TestEnsureMember_DefaultsToMemberRole(t *testing.T) {
	svc, addUser := newTestOrgService(t)
	ctx := context.Background()

	ownerID := addUser("owner@example.com", "owner")
	org, err := svc.Create(ctx, ownerID, &CreateRequest{Name: "Zhiyong", Slug: "zhiyong"})
	require.NoError(t, err)

	userID := addUser("federated@example.com", "federated")
	require.NoError(t, svc.EnsureMember(ctx, org.ID, userID, ""))

	member, err := svc.GetMember(ctx, org.ID, userID)
	require.NoError(t, err)
	assert.Equal(t, orgDomain.RoleMember, member.Role)
}

func TestEnsureMember_RejectsUnknownOrganization(t *testing.T) {
	svc, addUser := newTestOrgService(t)
	ctx := context.Background()

	userID := addUser("federated@example.com", "federated")
	require.Error(t, svc.EnsureMember(ctx, 999999, userID, orgDomain.RoleMember))
}

func TestEnsureMember_RejectsInvalidIdentifiers(t *testing.T) {
	svc, _ := newTestOrgService(t)
	ctx := context.Background()

	require.Error(t, svc.EnsureMember(ctx, 0, 1, orgDomain.RoleMember))
	require.Error(t, svc.EnsureMember(ctx, 1, 0, orgDomain.RoleMember))
}
