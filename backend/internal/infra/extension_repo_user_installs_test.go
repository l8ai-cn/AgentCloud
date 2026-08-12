package infra

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	"github.com/l8ai-cn/agentcloud/backend/internal/testkit"
)

func TestListUserInstalledSkills_AggregatesCurrentUserAcrossRepos(t *testing.T) {
	db := testkit.SetupTestDB(t)
	repo := NewExtensionRepository(db)
	ctx := context.Background()

	orgID, otherOrgID := int64(1), int64(2)
	userID, otherUserID := int64(10), int64(11)

	orgRepoA := insertTestRepository(t, db, orgID, "alpha", "organization", nil)
	orgRepoB := insertTestRepository(t, db, orgID, "beta", "organization", nil)
	privateOwn := insertTestRepository(t, db, orgID, "mine", "private", &userID)
	privateOther := insertTestRepository(t, db, orgID, "theirs", "private", &otherUserID)
	granted := insertTestRepository(t, db, orgID, "granted", "private", &otherUserID)
	insertResourceGrant(t, db, orgID, granted, userID)
	otherOrgRepo := insertTestRepository(t, db, otherOrgID, "other-org", "organization", nil)

	catalog := insertTestSkill(t, db, "format-go", "Format Go")
	mineA := insertTestInstalledSkill(t, db, orgID, orgRepoA, userID, extension.ScopeUser, "format-go", &catalog, true)
	mineB := insertTestInstalledSkill(t, db, orgID, orgRepoB, userID, extension.ScopeUser, "lint-go", nil, false)
	minePrivate := insertTestInstalledSkill(t, db, orgID, privateOwn, userID, extension.ScopeUser, "private-skill", nil, true)
	mineGranted := insertTestInstalledSkill(t, db, orgID, granted, userID, extension.ScopeUser, "granted-skill", nil, true)
	insertTestInstalledSkill(t, db, orgID, orgRepoA, otherUserID, extension.ScopeUser, "other-user", nil, true)
	insertTestInstalledSkill(t, db, orgID, orgRepoA, 0, extension.ScopeOrg, "org-skill", nil, true)
	insertTestInstalledSkill(t, db, orgID, privateOther, userID, extension.ScopeUser, "inaccessible", nil, true)
	insertTestInstalledSkill(t, db, otherOrgID, otherOrgRepo, userID, extension.ScopeUser, "cross-org", nil, true)

	got, err := repo.ListUserInstalledSkills(ctx, orgID, userID)
	require.NoError(t, err)
	require.Len(t, got, 4)

	bySlug := indexUserSkills(got)
	require.Equal(t, mineA, bySlug["format-go"].Install.ID)
	require.Equal(t, "Alpha", bySlug["format-go"].RepositoryName)
	require.Equal(t, "alpha", bySlug["format-go"].RepositorySlug)
	require.Equal(t, "Format Go", bySlug["format-go"].DisplayName())
	require.Equal(t, mineB, bySlug["lint-go"].Install.ID)
	require.Equal(t, "Beta", bySlug["lint-go"].RepositoryName)
	require.False(t, bySlug["lint-go"].Install.IsEnabled)
	require.Equal(t, "lint-go", bySlug["lint-go"].DisplayName())
	require.Equal(t, minePrivate, bySlug["private-skill"].Install.ID)
	require.Equal(t, mineGranted, bySlug["granted-skill"].Install.ID)
	require.NotContains(t, bySlug, "other-user")
	require.NotContains(t, bySlug, "org-skill")
	require.NotContains(t, bySlug, "inaccessible")
	require.NotContains(t, bySlug, "cross-org")
}

func TestListUserInstalledMcpServers_AggregatesCurrentUserAcrossRepos(t *testing.T) {
	db := testkit.SetupTestDB(t)
	repo := NewExtensionRepository(db)
	ctx := context.Background()

	orgID := int64(1)
	userID, otherUserID := int64(10), int64(11)
	orgRepoA := insertTestRepository(t, db, orgID, "alpha", "organization", nil)
	orgRepoB := insertTestRepository(t, db, orgID, "beta", "organization", nil)
	privateOther := insertTestRepository(t, db, orgID, "theirs", "private", &otherUserID)

	marketID := insertTestMcpMarketItem(t, db, "github", "GitHub MCP")
	mineA := insertTestInstalledMcp(t, db, orgID, orgRepoA, userID, extension.ScopeUser, "github", &marketID, true)
	mineB := insertTestInstalledMcp(t, db, orgID, orgRepoB, userID, extension.ScopeUser, "custom-stdio", nil, false)
	insertTestInstalledMcp(t, db, orgID, orgRepoA, otherUserID, extension.ScopeUser, "other-user", nil, true)
	insertTestInstalledMcp(t, db, orgID, orgRepoA, 0, extension.ScopeOrg, "org-mcp", nil, true)
	insertTestInstalledMcp(t, db, orgID, privateOther, userID, extension.ScopeUser, "inaccessible", nil, true)

	got, err := repo.ListUserInstalledMcpServers(ctx, orgID, userID)
	require.NoError(t, err)
	require.Len(t, got, 2)

	bySlug := indexUserMcps(got)
	require.Equal(t, mineA, bySlug["github"].Install.ID)
	require.Equal(t, "Alpha", bySlug["github"].RepositoryName)
	require.Equal(t, "alpha", bySlug["github"].RepositorySlug)
	require.Equal(t, "GitHub MCP", bySlug["github"].MarketItemName())
	require.Equal(t, "github", bySlug["github"].MarketItemSlug())
	require.Equal(t, mineB, bySlug["custom-stdio"].Install.ID)
	require.Equal(t, "Beta", bySlug["custom-stdio"].RepositoryName)
	require.False(t, bySlug["custom-stdio"].Install.IsEnabled)
	require.Empty(t, bySlug["custom-stdio"].MarketItemName())
	require.NotContains(t, bySlug, "other-user")
	require.NotContains(t, bySlug, "org-mcp")
	require.NotContains(t, bySlug, "inaccessible")
}

func indexUserSkills(rows []*extension.UserInstalledSkill) map[string]*extension.UserInstalledSkill {
	out := make(map[string]*extension.UserInstalledSkill, len(rows))
	for _, row := range rows {
		out[row.Install.Slug] = row
	}
	return out
}

func indexUserMcps(rows []*extension.UserInstalledMcpServer) map[string]*extension.UserInstalledMcpServer {
	out := make(map[string]*extension.UserInstalledMcpServer, len(rows))
	for _, row := range rows {
		out[row.Install.Slug] = row
	}
	return out
}

func insertTestRepository(t *testing.T, db *gorm.DB, orgID int64, slug, visibility string, importedBy *int64) int64 {
	t.Helper()
	row := gitprovider.Repository{
		OrganizationID:   orgID,
		ProviderType:     gitprovider.ProviderTypeGitHub,
		ProviderBaseURL:  "https://github.com",
		ExternalID:       slug,
		Name:             titleFromSlug(slug),
		Slug:             slug,
		Visibility:       visibility,
		ImportedByUserID: importedBy,
		IsActive:         true,
	}
	require.NoError(t, db.Create(&row).Error)
	return row.ID
}

func insertResourceGrant(t *testing.T, db *gorm.DB, orgID, repoID, userID int64) {
	t.Helper()
	require.NoError(t, db.Create(&grant.ResourceGrant{
		OrganizationID: orgID,
		ResourceType:   grant.TypeRepository,
		ResourceID:     grant.IntResourceID(repoID),
		UserID:         userID,
		GrantedBy:      userID,
	}).Error)
}

func insertTestSkill(t *testing.T, db *gorm.DB, slug, displayName string) int64 {
	t.Helper()
	require.NoError(t, db.Exec(
		`INSERT INTO skills (slug, display_name, is_active) VALUES (?, ?, 1)`,
		slug, displayName,
	).Error)
	var id int64
	require.NoError(t, db.Raw(`SELECT id FROM skills WHERE slug = ?`, slug).Scan(&id).Error)
	return id
}

func insertTestInstalledSkill(t *testing.T, db *gorm.DB, orgID, repoID, userID int64, scope, slug string, skillID *int64, enabled bool) int64 {
	t.Helper()
	row := extension.InstalledSkill{
		OrganizationID: orgID,
		RepositoryID:   repoID,
		SkillID:        skillID,
		Scope:          scope,
		Slug:           slug,
		InstallSource:  extension.InstallSourceCatalog,
		IsEnabled:      enabled,
	}
	if userID != 0 {
		row.InstalledBy = &userID
	}
	require.NoError(t, db.Create(&row).Error)
	if !enabled {
		require.NoError(t, db.Model(&row).Update("is_enabled", false).Error)
		row.IsEnabled = false
	}
	return row.ID
}

func insertTestMcpMarketItem(t *testing.T, db *gorm.DB, slug, name string) int64 {
	t.Helper()
	row := extension.McpMarketItem{Slug: slug, Name: name, IsActive: true}
	require.NoError(t, db.Create(&row).Error)
	return row.ID
}

func insertTestInstalledMcp(t *testing.T, db *gorm.DB, orgID, repoID, userID int64, scope, slug string, marketID *int64, enabled bool) int64 {
	t.Helper()
	row := extension.InstalledMcpServer{
		OrganizationID: orgID,
		RepositoryID:   repoID,
		MarketItemID:   marketID,
		Scope:          scope,
		Name:           slug,
		Slug:           slug,
		TransportType:  "stdio",
		IsEnabled:      enabled,
	}
	if userID != 0 {
		row.InstalledBy = &userID
	}
	require.NoError(t, db.Create(&row).Error)
	if !enabled {
		require.NoError(t, db.Model(&row).Update("is_enabled", false).Error)
		row.IsEnabled = false
	}
	return row.ID
}

func titleFromSlug(slug string) string {
	if slug == "" {
		return ""
	}
	return strings.ToUpper(slug[:1]) + slug[1:]
}
