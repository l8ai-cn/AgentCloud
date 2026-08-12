package extension

import (
	"context"
	"errors"
	"fmt"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	repositoryservice "github.com/l8ai-cn/agentcloud/backend/internal/service/repository"
)

type RepositoryAccess interface {
	GetAccessibleByID(ctx context.Context, id, orgID, userID int64) (*gitprovider.Repository, error)
}

func (s *Service) SetRepositoryAccess(access RepositoryAccess) {
	s.repos = access
}

func (s *Service) requireRepositoryAccess(ctx context.Context, orgID, repoID, userID int64) error {
	if s.repos == nil {
		return fmt.Errorf("%w: repository access checker is unavailable", ErrForbidden)
	}
	row, err := s.repos.GetAccessibleByID(ctx, repoID, orgID, userID)
	if err != nil {
		if errors.Is(err, repositoryservice.ErrNoPermission) ||
			errors.Is(err, repositoryservice.ErrRepositoryNotFound) {
			return fmt.Errorf("%w: repository %d", ErrForbidden, repoID)
		}
		return err
	}
	if row == nil || row.ID != repoID || row.OrganizationID != orgID || !row.IsActive {
		return fmt.Errorf("%w: repository %d", ErrForbidden, repoID)
	}
	return nil
}
