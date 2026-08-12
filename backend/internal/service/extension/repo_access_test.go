package extension

import (
	"context"
	"errors"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	repositoryservice "github.com/l8ai-cn/agentcloud/backend/internal/service/repository"
	"github.com/stretchr/testify/require"
)

type denyRepositoryAccess struct{}

func (denyRepositoryAccess) GetAccessibleByID(context.Context, int64, int64, int64) (*gitprovider.Repository, error) {
	return nil, repositoryservice.ErrNoPermission
}

func TestInstallSkillFromMarket_PrivateRepositoryDenied(t *testing.T) {
	orgID := int64(1)
	cat := &svcMockCatalog{
		getAnyByIDFn: func(_ context.Context, id int64) (*skilldom.Skill, error) {
			return &skilldom.Skill{
				ID:             id,
				OrganizationID: &orgID,
				Slug:           "secret-skill",
				IsActive:       true,
				ContentSha:     "abc",
				StorageKey:     "skills/secret-skill/v1.tar.gz",
			}, nil
		},
	}
	created := false
	repo := &svcMockRepo{
		createInstalledSkillFn: func(_ context.Context, _ *extension.InstalledSkill) error {
			created = true
			return nil
		},
	}
	svc := NewService(repo, &svcMockStorage{}, nil)
	svc.SetSkillCatalog(cat)
	svc.SetRepositoryAccess(denyRepositoryAccess{})

	_, err := svc.InstallSkillFromMarket(context.Background(), orgID, 99, 7, 100, "user")
	require.ErrorIs(t, err, ErrForbidden)
	require.False(t, created)
}

func TestListRepoSkills_PrivateRepositoryDenied(t *testing.T) {
	listed := false
	repo := &svcMockRepo{
		listInstalledSkillsFn: func(_ context.Context, _, _ int64, _ string) ([]*extension.InstalledSkill, error) {
			listed = true
			return nil, nil
		},
	}
	svc := NewService(repo, &svcMockStorage{}, nil)
	svc.SetRepositoryAccess(denyRepositoryAccess{})

	_, err := svc.ListRepoSkills(context.Background(), 1, 99, 7, "all")
	require.ErrorIs(t, err, ErrForbidden)
	require.False(t, listed)
}

func TestUpdateSkill_PrivateRepositoryDenied(t *testing.T) {
	repo := &svcMockRepo{
		getInstalledSkillFn: func(_ context.Context, id int64) (*extension.InstalledSkill, error) {
			return &extension.InstalledSkill{ID: id, OrganizationID: 1, RepositoryID: 99, Scope: "user"}, nil
		},
	}
	svc := NewService(repo, &svcMockStorage{}, nil)
	svc.SetRepositoryAccess(denyRepositoryAccess{})

	enabled := true
	_, err := svc.UpdateSkill(context.Background(), 1, 99, 10, 7, "member", &enabled, nil)
	require.ErrorIs(t, err, ErrForbidden)
}

func TestUninstallSkill_PrivateRepositoryDenied(t *testing.T) {
	deleted := false
	repo := &svcMockRepo{
		getInstalledSkillFn: func(_ context.Context, id int64) (*extension.InstalledSkill, error) {
			return &extension.InstalledSkill{ID: id, OrganizationID: 1, RepositoryID: 99, Scope: "user"}, nil
		},
		deleteInstalledSkillFn: func(_ context.Context, _ int64) error {
			deleted = true
			return nil
		},
	}
	svc := NewService(repo, &svcMockStorage{}, nil)
	svc.SetRepositoryAccess(denyRepositoryAccess{})

	err := svc.UninstallSkill(context.Background(), 1, 99, 10, 7, "member")
	require.ErrorIs(t, err, ErrForbidden)
	require.False(t, deleted)
}

func TestPresignSkillUpload_PrivateRepositoryDenied(t *testing.T) {
	svc := NewService(&svcMockRepo{}, &svcMockStorage{}, nil)
	svc.SetRepositoryAccess(denyRepositoryAccess{})

	_, err := svc.PresignSkillUpload(context.Background(), 1, 99, 7, "skill.tar.gz", "application/gzip", 12)
	require.ErrorIs(t, err, ErrForbidden)
}

func TestRequireRepositoryAccess_MissingChecker(t *testing.T) {
	svc := NewService(&svcMockRepo{}, &svcMockStorage{}, nil)
	err := svc.requireRepositoryAccess(context.Background(), 1, 99, 7)
	require.ErrorIs(t, err, ErrForbidden)
}

func TestRequireRepositoryAccess_NotFound(t *testing.T) {
	svc := NewService(&svcMockRepo{}, &svcMockStorage{}, nil)
	svc.SetRepositoryAccess(repositoryAccessFunc(func(context.Context, int64, int64, int64) (*gitprovider.Repository, error) {
		return nil, repositoryservice.ErrRepositoryNotFound
	}))
	err := svc.requireRepositoryAccess(context.Background(), 1, 99, 7)
	require.ErrorIs(t, err, ErrForbidden)
}

type repositoryAccessFunc func(context.Context, int64, int64, int64) (*gitprovider.Repository, error)

func (fn repositoryAccessFunc) GetAccessibleByID(ctx context.Context, id, orgID, userID int64) (*gitprovider.Repository, error) {
	return fn(ctx, id, orgID, userID)
}

func TestRequireRepositoryAccess_UnexpectedError(t *testing.T) {
	boom := errors.New("db down")
	svc := NewService(&svcMockRepo{}, &svcMockStorage{}, nil)
	svc.SetRepositoryAccess(repositoryAccessFunc(func(context.Context, int64, int64, int64) (*gitprovider.Repository, error) {
		return nil, boom
	}))
	err := svc.requireRepositoryAccess(context.Background(), 1, 99, 7)
	require.ErrorIs(t, err, boom)
	require.NotErrorIs(t, err, ErrForbidden)
}
