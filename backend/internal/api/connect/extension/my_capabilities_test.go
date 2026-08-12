package extensionconnect

import (
	"context"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	extdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	extensionv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/extension/v1"
)

func TestListMyInstalledSkills_MissingOrgSlug_InvalidArgument(t *testing.T) {
	srv := NewMyCapabilitiesServer(NewServer(nil, &fakeOrgService{role: "member"}))
	_, err := srv.ListMyInstalledSkills(ctxAsUser(42), connect.NewRequest(&extensionv1.ListMyInstalledSkillsRequest{}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

func TestListMyInstalledSkills_NoAuth_Unauthenticated(t *testing.T) {
	srv := NewMyCapabilitiesServer(NewServer(nil, &fakeOrgService{role: "member"}))
	_, err := srv.ListMyInstalledSkills(context.Background(), connect.NewRequest(&extensionv1.ListMyInstalledSkillsRequest{OrgSlug: "acme"}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeUnauthenticated, connectCodeOf(t, err))
}

func TestListMyInstalledMcpServers_MissingOrgSlug_InvalidArgument(t *testing.T) {
	srv := NewMyCapabilitiesServer(NewServer(nil, &fakeOrgService{role: "member"}))
	_, err := srv.ListMyInstalledMcpServers(ctxAsUser(42), connect.NewRequest(&extensionv1.ListMyInstalledMcpServersRequest{}))
	require.Error(t, err)
	assert.Equal(t, connect.CodeInvalidArgument, connectCodeOf(t, err))
}

func TestToProtoMyInstalledSkill_IncludesRepositoryAndDisplayName(t *testing.T) {
	repoID := int64(7)
	got := toProtoMyInstalledSkill(&extdom.UserInstalledSkill{
		Install: &extdom.InstalledSkill{
			ID:           1,
			RepositoryID: repoID,
			Slug:         "format-go",
			Skill:        &skilldom.Skill{DisplayName: "Format Go"},
			IsEnabled:    true,
		},
		RepositoryName: "Alpha",
		RepositorySlug: "alpha",
	})
	require.NotNil(t, got)
	assert.Equal(t, "Format Go", got.GetDisplayName())
	assert.Equal(t, repoID, got.GetRepository().GetId())
	assert.Equal(t, "Alpha", got.GetRepository().GetName())
	assert.Equal(t, "alpha", got.GetRepository().GetSlug())
	assert.Equal(t, "format-go", got.GetSkill().GetSlug())
}

func TestToProtoMyInstalledMcpServer_MarketItemOptional(t *testing.T) {
	custom := toProtoMyInstalledMcpServer(&extdom.UserInstalledMcpServer{
		Install:        &extdom.InstalledMcpServer{ID: 2, RepositoryID: 8, Slug: "custom-stdio"},
		RepositoryName: "Beta",
		RepositorySlug: "beta",
	})
	require.NotNil(t, custom)
	assert.Nil(t, custom.MarketItemName)
	assert.Nil(t, custom.MarketItemSlug)
	assert.Equal(t, "Beta", custom.GetRepository().GetName())

	fromMarket := toProtoMyInstalledMcpServer(&extdom.UserInstalledMcpServer{
		Install: &extdom.InstalledMcpServer{
			ID:           3,
			RepositoryID: 8,
			Slug:         "github",
			MarketItem:   &extdom.McpMarketItem{Name: "GitHub MCP", Slug: "github"},
		},
		RepositoryName: "Beta",
		RepositorySlug: "beta",
	})
	require.Equal(t, "GitHub MCP", fromMarket.GetMarketItemName())
	require.Equal(t, "github", fromMarket.GetMarketItemSlug())
}
