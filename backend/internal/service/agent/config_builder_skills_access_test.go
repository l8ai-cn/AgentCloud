package agent

import (
	"context"
	"testing"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
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
	skillsByID       []*extensionservice.ResolvedSkill
	skillsByPackages []*extensionservice.ResolvedSkill
}

var _ WorkerSkillProvider = (*workerSkillAccessProvider)(nil)

func (m *workerSkillAccessProvider) GetWorkerSkillsByIDs(
	_ context.Context, _ int64, _ []int64, _ string,
) ([]*extensionservice.ResolvedSkill, error) {
	return m.skillsByID, nil
}

func (m *workerSkillAccessProvider) GetWorkerSkillsByPackages(
	_ context.Context, _ []specdomain.SkillPackageBinding, _ string,
) ([]*extensionservice.ResolvedSkill, error) {
	return m.skillsByPackages, nil
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
	require.ErrorContains(t, err, "incomplete")
}

func pinnedBinding() specdomain.SkillPackageBinding {
	return specdomain.SkillPackageBinding{
		SkillID:     7,
		Slug:        "pinned",
		ContentSHA:  "sha7",
		PackageSize: 70,
	}
}

func pinnedResolvedSkill() *extensionservice.ResolvedSkill {
	return &extensionservice.ResolvedSkill{
		CatalogSkillID: 7,
		Slug:           "pinned",
		ContentSha:     "sha7",
		DownloadURL:    "https://example/7",
		PackageSize:    70,
	}
}

func buildPinned(t *testing.T, allowed map[int64]struct{}) ([]*runnerv1.ResourceToDownload, error) {
	t.Helper()
	builder := NewConfigBuilder(nilAgentConfigProvider{}, stubEnvBundleLoader{})
	builder.SetExtensionProvider(&workerSkillAccessProvider{
		stubSkillAccessGate: stubSkillAccessGate{allowed: allowed},
		skillsByPackages:    []*extensionservice.ResolvedSkill{pinnedResolvedSkill()},
	})
	return builder.buildPinnedWorkerSkillResources(
		context.Background(),
		&ConfigBuildRequest{
			OrganizationID:        1,
			UserID:                2,
			RequiredSkillPackages: []specdomain.SkillPackageBinding{pinnedBinding()},
		},
		"claude-code",
	)
}

func TestBuildPinnedWorkerSkillResources_RevokedSkillBlocksRelaunch(t *testing.T) {
	_, err := buildPinned(t, map[int64]struct{}{})
	require.ErrorContains(t, err, "no longer authorized")
}

func TestBuildPinnedWorkerSkillResources_AuthorizedSkillStillMounts(t *testing.T) {
	resources, err := buildPinned(t, map[int64]struct{}{7: {}})
	require.NoError(t, err)
	require.Len(t, resources, 1)
	require.Equal(t, "sha7", resources[0].Sha)
}

func TestBuildPinnedWorkerSkillResources_NilGateMountsUnchanged(t *testing.T) {
	resources, err := buildPinned(t, nil)
	require.NoError(t, err)
	require.Len(t, resources, 1)
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
