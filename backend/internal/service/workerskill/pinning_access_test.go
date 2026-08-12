package workerskill

import (
	"context"
	"testing"

	skilldomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/stretchr/testify/require"
)

type stubPinGrants map[string][]int64

func (s stubPinGrants) GetGrantedUserIDs(_ context.Context, resourceType, resourceID string) ([]int64, error) {
	return s[resourceType+":"+resourceID], nil
}

func TestPinSkills_OrgWhitelistDenied(t *testing.T) {
	orgID := int64(42)
	row := pinTestCatalogRow(9, "restricted")
	row.OrganizationID = &orgID
	remounter := NewRemounter(nil, nil, fakeCatalog{9: row}, nil, nil)
	remounter.SetGrants(stubPinGrants{"skill:9": {99}})
	ctx := middleware.SetTenant(context.Background(), &middleware.TenantContext{
		OrganizationID: orgID, UserID: 7, UserRole: organization.RoleMember,
	})
	_, err := remounter.pinSkills(ctx, orgID, "codex-cli", []int64{9})
	require.Error(t, err)
}

func TestPinSkills_NilGateBackwardCompatible(t *testing.T) {
	row := pinTestCatalogRow(9, "open-skill")
	remounter := NewRemounter(nil, nil, fakeCatalog{9: row}, nil, nil)
	_, err := remounter.pinSkills(context.Background(), testOrgID, "codex-cli", []int64{9})
	require.NoError(t, err)
}

func pinTestCatalogRow(id int64, slug string) *skilldomain.Skill {
	return &skilldomain.Skill{
		ID: id, Slug: slug, IsActive: true, Version: 1,
		ContentSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		StorageKey: "skills/" + slug + ".tar.gz", PackageSize: 64,
	}
}
