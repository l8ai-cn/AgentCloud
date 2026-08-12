package airesource

import (
	"context"
	"testing"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveOrgConnectionWithoutGrantsAllowsMember(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeOrg, 10, "org-open", "secret")
	resource := createResource(t, f, connection.ID, "org-model")

	_, err := f.service.ResolveMetadata(context.Background(), actor(3), 10, resource.ID, chatRequirements())
	require.NoError(t, err)
	_, err = f.service.ResolveExact(context.Background(), actor(3), 10, resource.ID, chatRequirements())
	require.NoError(t, err)
}

func TestResolveOrgConnectionWithGrantsDeniesUnlistedMember(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeOrg, 10, "org-restricted", "secret")
	resource := createResource(t, f, connection.ID, "restricted-model")
	f.grantConnectionUsers(connection.ID, 99)

	_, err := f.service.ResolveMetadata(context.Background(), actor(3), 10, resource.ID, chatRequirements())
	assert.ErrorIs(t, err, ErrNotGranted)
}

func TestResolveOrgConnectionWithGrantsAllowsListedMember(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeOrg, 10, "org-granted", "secret")
	resource := createResource(t, f, connection.ID, "granted-model")
	f.grantConnectionUsers(connection.ID, 3)

	_, err := f.service.ResolveMetadata(context.Background(), actor(3), 10, resource.ID, chatRequirements())
	require.NoError(t, err)
}

func TestResolveOrgConnectionWithGrantsAllowsOwnerAndAdmin(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeOrg, 10, "org-admin", "secret")
	resource := createResource(t, f, connection.ID, "admin-model")
	f.grantConnectionUsers(connection.ID, 99)

	for _, userID := range []int64{1, 2} {
		_, err := f.service.ResolveMetadata(context.Background(), actor(userID), 10, resource.ID, chatRequirements())
		require.NoError(t, err, "user %d", userID)
	}
}

func TestResolveUserConnectionIgnoresOrgGrants(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeUser, 1, "user-private", "secret")
	resource := createResource(t, f, connection.ID, "user-model")
	f.grantConnectionUsers(connection.ID, 99)

	_, err := f.service.ResolveMetadata(context.Background(), actor(1), 10, resource.ID, chatRequirements())
	require.NoError(t, err)
	_, err = f.service.ResolveMetadata(context.Background(), actor(2), 10, resource.ID, chatRequirements())
	assert.ErrorIs(t, err, ErrForbidden)
}

func TestListEffectiveMarksNotGrantedConnections(t *testing.T) {
	f := newFixture()
	openConnection := createValidConnection(t, f, domain.OwnerScopeOrg, 10, "org-open-list", "secret")
	openResource := createResource(t, f, openConnection.ID, "open-list-model")
	restrictedConnection := createValidConnection(t, f, domain.OwnerScopeOrg, 10, "org-restricted-list", "secret")
	restrictedResource := createResource(t, f, restrictedConnection.ID, "restricted-list-model")
	f.grantConnectionUsers(restrictedConnection.ID, 99)

	views, err := f.service.ListEffective(context.Background(), actor(3), 10, []domain.Modality{domain.ModalityChat})
	require.NoError(t, err)
	byID := map[int64]EffectiveResourceView{}
	for _, view := range views {
		byID[view.Resource.ID] = view
	}
	require.Contains(t, byID, openResource.ID)
	assert.True(t, byID[openResource.ID].CanUse)
	assert.True(t, byID[openResource.ID].Selectable)
	require.Contains(t, byID, restrictedResource.ID)
	assert.False(t, byID[restrictedResource.ID].CanUse)
	assert.False(t, byID[restrictedResource.ID].Selectable)
	assert.Equal(t, BlockingNotGranted, byID[restrictedResource.ID].BlockingReason)
}

func TestEnsureSelectableReturnsNotGranted(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeOrg, 10, "org-selectable", "secret")
	resource := createResource(t, f, connection.ID, "selectable-model")
	f.grantConnectionUsers(connection.ID, 99)

	err := f.service.EnsureSelectable(context.Background(), actor(3), 10, resource.ID)
	assert.ErrorIs(t, err, ErrNotGranted)
}
