package agent

import (
	"context"
	"testing"

	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
	"github.com/stretchr/testify/require"
)

type stubSkillAccessGate struct {
	allowed map[int64]struct{}
}

func (s stubSkillAccessGate) AllowedCatalogSkillIDs(
	_ context.Context, _, _ int64, _ string, ids []int64,
) (map[int64]struct{}, error) {
	if s.allowed == nil {
		out := make(map[int64]struct{}, len(ids))
		for _, id := range ids {
			out[id] = struct{}{}
		}
		return out, nil
	}
	out := make(map[int64]struct{})
	for _, id := range ids {
		if _, ok := s.allowed[id]; ok {
			out[id] = struct{}{}
		}
	}
	return out, nil
}

type workerSkillAccessProvider struct {
	mockSkillExtensionProvider
	stubSkillAccessGate
	skillsByID []*extensionservice.ResolvedSkill
}

func (m *workerSkillAccessProvider) GetWorkerSkillsByIDs(
	_ context.Context, _, _ int64, _ []int64, _ string,
) ([]*extensionservice.ResolvedSkill, error) {
	return m.skillsByID, nil
}

func TestBuildWorkerSpecSkillResources_RevokedSkillNotMounted(t *testing.T) {
	builder := NewConfigBuilder(nilAgentConfigProvider{}, stubEnvBundleLoader{})
	builder.SetExtensionProvider(&workerSkillAccessProvider{
		stubSkillAccessGate: stubSkillAccessGate{allowed: map[int64]struct{}{}},
		skillsByID: []*extensionservice.ResolvedSkill{
			{
				CatalogSkillID: 3,
				Slug:           "revoked",
				ContentSha:     "sha",
				DownloadURL:    "https://example/skill",
				PackageSize:    1,
			},
		},
	})
	_, err := builder.buildWorkerSpecSkillResources(
		context.Background(),
		&ConfigBuildRequest{OrganizationID: 1, UserID: 2, RequiredSkillIDs: []int64{3}},
		"claude-code",
	)
	require.Error(t, err)
}

func TestBuildSkillResources_FiltersRevokedInstalledSkills(t *testing.T) {
	repoID := int64(99)
	builder := NewConfigBuilder(nilAgentConfigProvider{}, stubEnvBundleLoader{})
	builder.SetExtensionProvider(&workerSkillAccessProvider{
		mockSkillExtensionProvider: mockSkillExtensionProvider{
			skills: []*extensionservice.ResolvedSkill{
				{CatalogSkillID: 1, Slug: "allowed", ContentSha: "sha1", DownloadURL: "https://example/1", PackageSize: 10},
				{CatalogSkillID: 2, Slug: "revoked", ContentSha: "sha2", DownloadURL: "https://example/2", PackageSize: 20},
			},
		},
		stubSkillAccessGate: stubSkillAccessGate{allowed: map[int64]struct{}{1: {}}},
	})
	resources, err := builder.buildSkillResources(
		context.Background(),
		&ConfigBuildRequest{OrganizationID: 1, UserID: 2, RepositoryID: &repoID},
		"claude-code",
		nil,
	)
	require.NoError(t, err)
	require.Len(t, resources, 1)
	require.Equal(t, "sha1", resources[0].Sha)
}
