package extension

import (
	"context"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type memorySkillGrants map[string][]int64

func (m memorySkillGrants) GetGrantedUserIDs(_ context.Context, resourceType, resourceID string) ([]int64, error) {
	return m[resourceType+":"+resourceID], nil
}

type allowRepositoryAccess struct{}

func (allowRepositoryAccess) GetAccessibleByID(
	_ context.Context, id, orgID int64, _ int64,
) (*gitprovider.Repository, error) {
	return &gitprovider.Repository{ID: id, OrganizationID: orgID, IsActive: true}, nil
}

func installTestService(t *testing.T, repo *svcMockRepo, catalog *svcMockCatalog) *Service {
	t.Helper()
	svc := NewService(repo, nil, nil)
	svc.SetSkillCatalog(catalog)
	svc.SetRepositoryAccess(allowRepositoryAccess{})
	return svc
}

type fakeSkillEntitlementGate struct {
	requireErr error
	snap       SkillEntitlementSnapshot
}

func (f fakeSkillEntitlementGate) Require(context.Context, int64, int64, string, string, string) error {
	return f.requireErr
}

func (f fakeSkillEntitlementGate) SnapshotFor(context.Context, int64) (SkillEntitlementSnapshot, error) {
	return f.snap, nil
}

type fakeSkillEntitlementSnapshot struct {
	allowed map[string]bool
}

func (f fakeSkillEntitlementSnapshot) Decide(_ string, key string, _ int64, _ string) SkillEntitlementDecision {
	if f.allowed == nil || f.allowed[key] {
		return SkillEntitlementDecision{Allowed: true}
	}
	return SkillEntitlementDecision{Allowed: false}
}

func TestRequireSkillUse_NilDepsAllow(t *testing.T) {
	row := &skilldom.Skill{ID: 1, Slug: "alpha", IsActive: true}
	require.NoError(t, RequireSkillUse(context.Background(), nil, nil, 1, 9, organization.RoleMember, row))

	orgID := int64(1)
	row = &skilldom.Skill{ID: 2, Slug: "team-skill", OrganizationID: &orgID, IsActive: true}
	require.NoError(t, RequireSkillUse(context.Background(), nil, nil, 1, 9, organization.RoleMember, row))
}

func TestRequireSkillUse_PlatformClosedDenied(t *testing.T) {
	row := &skilldom.Skill{ID: 1, Slug: "closed-skill", IsActive: true}
	gate := fakeSkillEntitlementGate{requireErr: ErrForbidden}
	err := RequireSkillUse(context.Background(), gate, nil, 1, 9, organization.RoleMember, row)
	require.Error(t, err)
}

func TestRequireSkillUse_OrgSkillWhitelist(t *testing.T) {
	orgID := int64(1)
	row := &skilldom.Skill{ID: 5, Slug: "team-skill", OrganizationID: &orgID, IsActive: true}
	grants := memorySkillGrants{"skill:5": {42}}

	require.Error(t, RequireSkillUse(context.Background(), nil, grants, 1, 9, organization.RoleMember, row))
	require.NoError(t, RequireSkillUse(context.Background(), nil, grants, 1, 42, organization.RoleMember, row))
	require.NoError(t, RequireSkillUse(context.Background(), nil, grants, 1, 99, organization.RoleAdmin, row))
}

func TestAllowedCatalogSkillIDs_Batch(t *testing.T) {
	orgID := int64(1)
	platform := &skilldom.Skill{ID: 1, Slug: "open-skill", IsActive: true}
	orgSkill := &skilldom.Skill{ID: 2, Slug: "team-skill", OrganizationID: &orgID, IsActive: true}
	catalog := &svcMockCatalog{
		getAnyByIDFn: func(_ context.Context, id int64) (*skilldom.Skill, error) {
			switch id {
			case 1:
				return platform, nil
			case 2:
				return orgSkill, nil
			default:
				return nil, skilldom.ErrNotFound
			}
		},
	}
	svc := NewService(nil, nil, nil)
	svc.SetSkillCatalog(catalog)
	svc.SetGrants(memorySkillGrants{"skill:2": {7}})

	allowed, err := svc.AllowedCatalogSkillIDs(
		context.Background(), 1, 9, organization.RoleMember, []int64{1, 2},
	)
	require.NoError(t, err)
	assert.Contains(t, allowed, int64(1))
	assert.NotContains(t, allowed, int64(2))

	allowed, err = svc.AllowedCatalogSkillIDs(
		context.Background(), 1, 7, organization.RoleMember, []int64{1, 2},
	)
	require.NoError(t, err)
	assert.Contains(t, allowed, int64(1))
	assert.Contains(t, allowed, int64(2))
}

func TestInstallSkillFromMarket_OrgWhitelistDenied(t *testing.T) {
	orgID := int64(1)
	svc := installTestService(t, &svcMockRepo{}, &svcMockCatalog{
		getAnyByIDFn: func(_ context.Context, id int64) (*skilldom.Skill, error) {
			return &skilldom.Skill{
				ID: id, Slug: "team-skill", OrganizationID: &orgID, IsActive: true,
				ContentSha: "abc", StorageKey: "skills/team.tar.gz", PackageSize: 1,
			}, nil
		},
	})
	svc.SetGrants(memorySkillGrants{"skill:100": {42}})
	ctx := middleware.SetTenant(context.Background(), &middleware.TenantContext{
		OrganizationID: orgID, UserID: 3, UserRole: organization.RoleMember,
	})
	_, err := svc.InstallSkillFromMarket(ctx, orgID, 2, 3, 100, "org")
	require.ErrorIs(t, err, ErrForbidden)
}

func TestInstallSkillFromMarket_NilGateBackwardCompatible(t *testing.T) {
	skillID := int64(100)
	svc := installTestService(t, &svcMockRepo{
		createInstalledSkillFn: func(context.Context, *extension.InstalledSkill) error { return nil },
	}, &svcMockCatalog{
		getAnyByIDFn: func(_ context.Context, id int64) (*skilldom.Skill, error) {
			return &skilldom.Skill{
				ID: id, Slug: "test-skill", IsActive: true,
				ContentSha: "abc", StorageKey: "skills/test.tar.gz", PackageSize: 1,
			}, nil
		},
	})
	_, err := svc.InstallSkillFromMarket(context.Background(), 1, 2, 3, skillID, "org")
	require.NoError(t, err)
}
