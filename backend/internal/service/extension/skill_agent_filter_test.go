package extension

import (
	"context"
	"encoding/json"
	"io"
	"strings"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
	"github.com/stretchr/testify/require"
)

func TestAgentFilterFromFrontmatter(t *testing.T) {
	require.Equal(t, []string{"claude-code"}, agentFilterFromFrontmatter(map[string]string{
		"compatibility": "claude-code",
	}))
	require.Equal(t, []string{"claude-code", "codex-cli"}, agentFilterFromFrontmatter(map[string]string{
		"agent-filter": `["claude-code","codex-cli"]`,
		"compatibility": "ignored-when-agent-filter-present",
	}))
	require.Nil(t, agentFilterFromFrontmatter(map[string]string{}))
}

func TestFilterSkillsByAgent_GitHubInstallUsesPackedFilter(t *testing.T) {
	skills := []*extension.InstalledSkill{
		{
			Slug:          "github-skill",
			InstallSource: "github",
			AgentFilter:   json.RawMessage(`["claude-code"]`),
		},
	}
	require.Empty(t, filterSkillsByAgent(skills, "aider"))
	require.Len(t, filterSkillsByAgent(skills, "claude-code"), 1)
}

func TestHydratePackedAgentFiltersLoadsSidecar(t *testing.T) {
	stor := &svcMockStorage{
		existsFn: func(_ context.Context, key string) (bool, error) {
			return strings.HasSuffix(key, ".agent-filter.json"), nil
		},
		downloadFn: func(_ context.Context, key string) (io.ReadCloser, int64, error) {
			body := []byte(`["codex-cli"]`)
			return io.NopCloser(strings.NewReader(string(body))), int64(len(body)), nil
		},
	}
	svc := newTestService(&svcMockRepo{}, stor, nil)
	skills := []*extension.InstalledSkill{
		{Slug: "packed", InstallSource: "github", StorageKey: "skills/direct/packed/abc.tar.gz"},
	}
	svc.hydratePackedAgentFilters(context.Background(), skills)
	require.JSONEq(t, `["codex-cli"]`, string(skills[0].AgentFilter))
}
