package imbridge

import (
	"context"
	"testing"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	"github.com/stretchr/testify/require"
)

func bindingBridge(binding *domain.IdentityBinding) (*Bridge, *fakeRepository) {
	repo := &fakeRepository{
		connection: &domain.Connection{ID: 7, OrganizationID: 1, Provider: domain.ProviderFeishu},
		binding:    binding,
	}
	return newTestBridge(repo), repo
}

func TestSetIdentityBindingStatusBlockKeepsClaimedUser(t *testing.T) {
	userID := int64(42)
	b, _ := bindingBridge(&domain.IdentityBinding{ID: 3, ConnectionID: 7, UserID: &userID, Status: domain.BindingBound})

	got, err := b.SetIdentityBindingStatus(context.Background(), 1, 7, 3, domain.BindingBlocked)
	require.NoError(t, err)
	require.Equal(t, domain.BindingBlocked, got.Status)
	require.Equal(t, &userID, got.UserID)
}

func TestSetIdentityBindingStatusPendingDropsClaim(t *testing.T) {
	userID := int64(42)
	b, _ := bindingBridge(&domain.IdentityBinding{ID: 3, ConnectionID: 7, UserID: &userID, Status: domain.BindingBlocked})

	got, err := b.SetIdentityBindingStatus(context.Background(), 1, 7, 3, domain.BindingPending)
	require.NoError(t, err)
	require.Equal(t, domain.BindingPending, got.Status)
	require.Nil(t, got.UserID)
}

func TestSetIdentityBindingStatusRejectsGrantWithoutPairing(t *testing.T) {
	b, _ := bindingBridge(&domain.IdentityBinding{ID: 3, ConnectionID: 7, Status: domain.BindingPending})

	_, err := b.SetIdentityBindingStatus(context.Background(), 1, 7, 3, domain.BindingBound)
	require.ErrorIs(t, err, ErrInvalidConfig)
}

func TestSetIdentityBindingStatusRejectsUnknownStatus(t *testing.T) {
	b, _ := bindingBridge(&domain.IdentityBinding{ID: 3, ConnectionID: 7, Status: domain.BindingPending})

	_, err := b.SetIdentityBindingStatus(context.Background(), 1, 7, 3, "approved")
	require.ErrorIs(t, err, ErrInvalidConfig)
}

func TestSetIdentityBindingStatusMissingBinding(t *testing.T) {
	b, _ := bindingBridge(nil)

	_, err := b.SetIdentityBindingStatus(context.Background(), 1, 7, 3, domain.BindingBlocked)
	require.ErrorIs(t, err, ErrNotFound)
}

func TestDeleteIdentityBindingScopesToConnection(t *testing.T) {
	b, repo := bindingBridge(&domain.IdentityBinding{ID: 3, ConnectionID: 7})

	require.NoError(t, b.DeleteIdentityBinding(context.Background(), 1, 7, 3))
	require.Equal(t, [2]int64{7, 3}, repo.deletedBinding)
}
