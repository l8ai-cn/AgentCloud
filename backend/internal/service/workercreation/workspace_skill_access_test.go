package workercreation

import (
	"context"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	"github.com/stretchr/testify/require"
)

type stubSkillGrants map[string][]int64

func (s stubSkillGrants) GetGrantedUserIDs(_ context.Context, resourceType, resourceID string) ([]int64, error) {
	return s[resourceType+":"+resourceID], nil
}

type stubMemberRoles map[int64]string

func (s stubMemberRoles) GetMemberRole(_ context.Context, _, userID int64) (string, error) {
	return s[userID], nil
}

func TestResolveSkill_OrgWhitelistDenied(t *testing.T) {
	orgID := int64(77)
	row := &skill.Skill{
		ID: 3, Slug: "code-review", OrganizationID: &orgID, IsActive: true,
		ContentSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		StorageKey: "skills/code-review.tar.gz", PackageSize: 128, Version: 2,
	}
	resolver := newWorkspaceResolver(workspaceResolverDeps{
		Skills: &workspaceSkillLookup{rows: map[int64]*skill.Skill{3: row}},
		Grants: stubSkillGrants{"skill:3": {42}},
	})
	scope := specservice.Scope{OrgID: orgID, UserID: 7}
	_, err := resolver.resolveSkill(context.Background(), scope, slugkit.MustNewForTest("codex-cli"), 3)
	require.Error(t, err)
}

func TestResolveSkill_OrgWhitelistGranted(t *testing.T) {
	orgID := int64(77)
	row := &skill.Skill{
		ID: 3, Slug: "code-review", OrganizationID: &orgID, IsActive: true,
		ContentSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		StorageKey: "skills/code-review.tar.gz", PackageSize: 128, Version: 2,
	}
	resolver := newWorkspaceResolver(workspaceResolverDeps{
		Skills:      &workspaceSkillLookup{rows: map[int64]*skill.Skill{3: row}},
		Grants:      stubSkillGrants{"skill:3": {7}},
		MemberRoles: stubMemberRoles{7: organization.RoleMember},
	})
	scope := specservice.Scope{OrgID: orgID, UserID: 7}
	_, err := resolver.resolveSkill(context.Background(), scope, slugkit.MustNewForTest("codex-cli"), 3)
	require.NoError(t, err)
}

func TestResolveSkill_NilEntitlementsBackwardCompatible(t *testing.T) {
	fixture := newWorkspaceFixture()
	resolver := newWorkspaceResolver(fixture.deps())
	scope := specservice.Scope{OrgID: 77, UserID: 7}
	_, err := resolver.resolveSkill(context.Background(), scope, slugkit.MustNewForTest("codex-cli"), 3)
	require.NoError(t, err)
}
