package repository

import (
	"context"
	"slices"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
)

type GrantQuerier interface {
	GetGrantedUserIDs(ctx context.Context, resourceType, resourceID string) ([]int64, error)
}

func (s *Service) GetAccessibleByID(ctx context.Context, id, orgID, userID int64) (*gitprovider.Repository, error) {
	repo, err := s.repo.GetByID(ctx, id)
	return s.accessibleRepository(ctx, repo, err, orgID, userID)
}

func (s *Service) FindAccessibleByOrgSlug(ctx context.Context, orgID, userID int64, slug string) (*gitprovider.Repository, error) {
	repos, err := s.repo.ListByOrgSlug(ctx, orgID, slug)
	if err != nil {
		return nil, err
	}

	var accessible *gitprovider.Repository
	for _, repo := range repos {
		ok, accessErr := s.repositoryAccessible(ctx, repo, orgID, userID)
		if accessErr != nil {
			return nil, accessErr
		}
		if !ok {
			continue
		}
		if accessible != nil {
			return nil, ErrAmbiguousRepositorySlug
		}
		accessible = repo
	}
	if accessible == nil {
		return nil, ErrNoPermission
	}
	return accessible, nil
}

func (s *Service) accessibleRepository(
	ctx context.Context,
	repo *gitprovider.Repository,
	err error,
	orgID, userID int64,
) (*gitprovider.Repository, error) {
	if err != nil {
		return nil, err
	}
	ok, accessErr := s.repositoryAccessible(ctx, repo, orgID, userID)
	if accessErr != nil {
		return nil, accessErr
	}
	if !ok {
		return nil, ErrNoPermission
	}
	return repo, nil
}

func (s *Service) repositoryAccessible(ctx context.Context, repo *gitprovider.Repository, orgID, userID int64) (bool, error) {
	if repo == nil || repo.OrganizationID != orgID {
		return false, nil
	}
	if repo.Visibility == "organization" {
		return true, nil
	}
	if repo.Visibility == "private" && repo.ImportedByUserID != nil && *repo.ImportedByUserID == userID {
		return true, nil
	}
	return s.grantedPrivateRepository(ctx, repo, userID)
}

func (s *Service) grantedPrivateRepository(ctx context.Context, repo *gitprovider.Repository, userID int64) (bool, error) {
	if s.grants == nil || repo.Visibility != "private" {
		return false, nil
	}
	granted, err := s.grants.GetGrantedUserIDs(ctx, grant.TypeRepository, grant.IntResourceID(repo.ID))
	if err != nil {
		return false, err
	}
	return slices.Contains(granted, userID), nil
}
