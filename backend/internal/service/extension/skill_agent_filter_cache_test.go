package extension

import (
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	"github.com/stretchr/testify/require"
)

func hydrateTwice(t *testing.T, stor *svcMockStorage) {
	t.Helper()
	svc := NewService(nil, stor, nil)
	for range 2 {
		svc.hydratePackedAgentFilters(context.Background(), []*extension.InstalledSkill{
			{Slug: "packed", StorageKey: "skills/abc123.tar.gz"},
		})
	}
}

func TestHydratePackedAgentFilters_CachesMissingSidecar(t *testing.T) {
	existsCalls := 0
	hydrateTwice(t, &svcMockStorage{
		existsFn: func(context.Context, string) (bool, error) {
			existsCalls++
			return false, nil
		},
	})
	require.Equal(t, 1, existsCalls)
}

func TestHydratePackedAgentFilters_CachesPresentSidecar(t *testing.T) {
	existsCalls, downloadCalls := 0, 0
	hydrateTwice(t, &svcMockStorage{
		existsFn: func(context.Context, string) (bool, error) {
			existsCalls++
			return true, nil
		},
		downloadFn: func(context.Context, string) (io.ReadCloser, int64, error) {
			downloadCalls++
			raw := []byte(`["claude-code"]`)
			return io.NopCloser(bytes.NewReader(raw)), int64(len(raw)), nil
		},
	})
	require.Equal(t, 1, existsCalls)
	require.Equal(t, 1, downloadCalls)
}

func TestHydratePackedAgentFilters_AppliesCachedSidecar(t *testing.T) {
	svc := NewService(nil, &svcMockStorage{
		existsFn: func(context.Context, string) (bool, error) { return true, nil },
		downloadFn: func(context.Context, string) (io.ReadCloser, int64, error) {
			raw := []byte(`["claude-code"]`)
			return io.NopCloser(bytes.NewReader(raw)), int64(len(raw)), nil
		},
	}, nil)
	skill := &extension.InstalledSkill{Slug: "packed", StorageKey: "skills/abc123.tar.gz"}
	svc.hydratePackedAgentFilters(context.Background(), []*extension.InstalledSkill{skill})
	require.JSONEq(t, `["claude-code"]`, string(skill.AgentFilter))
	require.True(t, installedSkillAllowsAgent(skill, "claude-code"))
	require.False(t, installedSkillAllowsAgent(skill, "codex-cli"))
}
