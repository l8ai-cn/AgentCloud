package infra

import (
	"context"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	"gorm.io/gorm"
)

func (r *extensionRepo) ListUserInstalledSkills(ctx context.Context, orgID, userID int64) ([]*extension.UserInstalledSkill, error) {
	var skills []*extension.InstalledSkill
	if err := r.db.WithContext(ctx).
		Where("organization_id = ? AND scope = ? AND installed_by = ?", orgID, extension.ScopeUser, userID).
		Where("repository_id IN (?)", r.accessibleRepositoryIDs(orgID, userID)).
		Preload("Skill").
		Order("created_at DESC").
		Find(&skills).Error; err != nil {
		return nil, err
	}
	identities, err := r.repositoryIdentities(ctx, collectRepositoryIDs(skills, func(s *extension.InstalledSkill) int64 {
		return s.RepositoryID
	}))
	if err != nil {
		return nil, err
	}
	out := make([]*extension.UserInstalledSkill, 0, len(skills))
	for _, skill := range skills {
		out = append(out, &extension.UserInstalledSkill{
			Install:        skill,
			RepositoryName: identities[skill.RepositoryID].name,
			RepositorySlug: identities[skill.RepositoryID].slug,
		})
	}
	return out, nil
}

func (r *extensionRepo) ListUserInstalledMcpServers(ctx context.Context, orgID, userID int64) ([]*extension.UserInstalledMcpServer, error) {
	var servers []*extension.InstalledMcpServer
	if err := r.db.WithContext(ctx).
		Where("organization_id = ? AND scope = ? AND installed_by = ?", orgID, extension.ScopeUser, userID).
		Where("repository_id IN (?)", r.accessibleRepositoryIDs(orgID, userID)).
		Preload("MarketItem").
		Order("created_at DESC").
		Find(&servers).Error; err != nil {
		return nil, err
	}
	identities, err := r.repositoryIdentities(ctx, collectRepositoryIDs(servers, func(s *extension.InstalledMcpServer) int64 {
		return s.RepositoryID
	}))
	if err != nil {
		return nil, err
	}
	out := make([]*extension.UserInstalledMcpServer, 0, len(servers))
	for _, server := range servers {
		out = append(out, &extension.UserInstalledMcpServer{
			Install:        server,
			RepositoryName: identities[server.RepositoryID].name,
			RepositorySlug: identities[server.RepositoryID].slug,
		})
	}
	return out, nil
}

func (r *extensionRepo) accessibleRepositoryIDs(orgID, userID int64) *gorm.DB {
	return r.db.Model(&gitprovider.Repository{}).
		Select("id").
		Where("organization_id = ? AND is_active = ? AND deleted_at IS NULL", orgID, true).
		Where("(visibility = 'organization' OR (visibility = 'private' AND imported_by_user_id = ?) OR CAST(id AS TEXT) IN (SELECT resource_id FROM resource_grants WHERE resource_type = ? AND user_id = ? AND organization_id = ?))",
			userID, grant.TypeRepository, userID, orgID)
}

type repositoryIdentity struct {
	name string
	slug string
}

func (r *extensionRepo) repositoryIdentities(ctx context.Context, ids []int64) (map[int64]repositoryIdentity, error) {
	out := make(map[int64]repositoryIdentity, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	var repos []gitprovider.Repository
	if err := r.db.WithContext(ctx).
		Select("id, name, slug").
		Where("id IN ?", ids).
		Find(&repos).Error; err != nil {
		return nil, err
	}
	for _, repo := range repos {
		out[repo.ID] = repositoryIdentity{name: repo.Name, slug: repo.Slug}
	}
	return out, nil
}

func collectRepositoryIDs[T any](rows []T, id func(T) int64) []int64 {
	seen := make(map[int64]struct{}, len(rows))
	ids := make([]int64, 0, len(rows))
	for _, row := range rows {
		repoID := id(row)
		if _, ok := seen[repoID]; ok {
			continue
		}
		seen[repoID] = struct{}{}
		ids = append(ids, repoID)
	}
	return ids
}
