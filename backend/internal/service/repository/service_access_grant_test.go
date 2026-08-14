package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	"github.com/stretchr/testify/require"
)

type memoryRepositoryGrants struct {
	users map[string][]int64
	err   error
}

func (m memoryRepositoryGrants) GetGrantedUserIDs(_ context.Context, resourceType, resourceID string) ([]int64, error) {
	if m.err != nil {
		return nil, m.err
	}
	if resourceType != grant.TypeRepository {
		return nil, nil
	}
	return m.users[resourceID], nil
}

func TestGetAccessibleByIDHonorsRepositoryGrant(t *testing.T) {
	service, db := setupTestService(t)
	ownerID := int64(41)
	granteeID := int64(99)
	repo := newOrgSlugAccessTestRepository("github", "private", int64Pointer(ownerID))
	require.NoError(t, db.Create(repo).Error)
	service.SetGrantQuerier(memoryRepositoryGrants{
		users: map[string][]int64{grant.IntResourceID(repo.ID): {granteeID}},
	})

	got, err := service.GetAccessibleByID(context.Background(), repo.ID, 7, granteeID)
	require.NoError(t, err)
	require.Equal(t, repo.ID, got.ID)
}

func TestGetAccessibleByIDIgnoresGrantWhenQuerierNil(t *testing.T) {
	service, db := setupTestService(t)
	ownerID := int64(41)
	repo := newOrgSlugAccessTestRepository("github", "private", int64Pointer(ownerID))
	require.NoError(t, db.Create(repo).Error)

	got, err := service.GetAccessibleByID(context.Background(), repo.ID, 7, 99)
	require.ErrorIs(t, err, ErrNoPermission)
	require.Nil(t, got)
}

func TestFindAccessibleByOrgSlugHonorsRepositoryGrant(t *testing.T) {
	service, db := setupTestService(t)
	ownerID := int64(41)
	granteeID := int64(99)
	repo := newOrgSlugAccessTestRepository("github", "private", int64Pointer(ownerID))
	require.NoError(t, db.Create(repo).Error)
	service.SetGrantQuerier(memoryRepositoryGrants{
		users: map[string][]int64{grant.IntResourceID(repo.ID): {granteeID}},
	})

	got, err := service.FindAccessibleByOrgSlug(context.Background(), 7, granteeID, "access/test")
	require.NoError(t, err)
	require.Equal(t, repo.ID, got.ID)
}

func TestGetAccessibleByIDPropagatesGrantLookupError(t *testing.T) {
	service, db := setupTestService(t)
	ownerID := int64(41)
	repo := newOrgSlugAccessTestRepository("github", "private", int64Pointer(ownerID))
	require.NoError(t, db.Create(repo).Error)
	service.SetGrantQuerier(memoryRepositoryGrants{err: errors.New("grant lookup failed")})

	got, err := service.GetAccessibleByID(context.Background(), repo.ID, 7, 99)
	require.EqualError(t, err, "grant lookup failed")
	require.Nil(t, got)
}
