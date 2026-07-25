package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubOrgBinder struct {
	byTenant map[string]int64
	synced   []syncedMember
}

type syncedMember struct {
	orgID, userID int64
	role          string
}

func (s *stubOrgBinder) SyncFederatedMember(_ context.Context, orgID, userID int64, role string) error {
	s.synced = append(s.synced, syncedMember{orgID: orgID, userID: userID, role: role})
	return nil
}

func (s *stubOrgBinder) ResolveAmpTenant(_ context.Context, ampTenantID string) (int64, error) {
	id, ok := s.byTenant[ampTenantID]
	if !ok {
		return 0, organization.ErrNotFound
	}
	return id, nil
}

func TestResolveFederatedOrgID(t *testing.T) {
	svc := &Service{orgBinder: &stubOrgBinder{byTenant: map[string]int64{"6": 2}}}
	defaultOrg := int64(2)

	t.Run("tenant mapping wins", func(t *testing.T) {
		orgID, err := svc.resolveFederatedOrgID(context.Background(), &SSOLoginRequest{
			IdPTenantID:           "6",
			DefaultOrganizationID: &defaultOrg,
		})
		require.NoError(t, err)
		assert.Equal(t, int64(2), orgID)
	})

	t.Run("unbound tenant fails closed", func(t *testing.T) {
		_, err := svc.resolveFederatedOrgID(context.Background(), &SSOLoginRequest{IdPTenantID: "99"})
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrSSOTenantUnbound))
	})

	t.Run("mismatch fails", func(t *testing.T) {
		wrong := int64(1)
		_, err := svc.resolveFederatedOrgID(context.Background(), &SSOLoginRequest{
			IdPTenantID:           "6",
			DefaultOrganizationID: &wrong,
		})
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrSSOTenantMismatch))
	})

	t.Run("fallback to default org", func(t *testing.T) {
		orgID, err := svc.resolveFederatedOrgID(context.Background(), &SSOLoginRequest{
			DefaultOrganizationID: &defaultOrg,
		})
		require.NoError(t, err)
		assert.Equal(t, int64(2), orgID)
	})
}
