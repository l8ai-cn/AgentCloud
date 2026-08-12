package extensionconnect

import (
	"context"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/gitprovider"
	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
	repositoryservice "github.com/l8ai-cn/agentcloud/backend/internal/service/repository"
	extensionv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/extension/v1"
)

type denyAccessibleRepo struct{}

func (denyAccessibleRepo) GetAccessibleByID(
	_ context.Context, _, _, _ int64,
) (*gitprovider.Repository, error) {
	return nil, repositoryservice.ErrNoPermission
}

func TestInstallSkillFromMarket_PrivateRepositoryDenied(t *testing.T) {
	ext := extensionservice.NewService(nil, nil, nil)
	ext.SetRepositoryAccess(denyAccessibleRepo{})
	srv := NewRepoSkillServer(NewServer(ext, &fakeOrgService{role: "member"}))

	_, err := srv.InstallSkillFromMarket(
		ctxAsUser(42),
		connect.NewRequest(&extensionv1.InstallSkillFromMarketRequest{
			OrgSlug:      "acme",
			RepositoryId: 99,
			MarketItemId: 100,
			Scope:        "user",
		}),
	)
	require.Error(t, err)
	assert.Equal(t, connect.CodePermissionDenied, connectCodeOf(t, err))
}
