package operatorcatalog

import (
	"strings"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	"github.com/stretchr/testify/require"
)

func TestOperatorPartnerManifestIsCompleteAndInternallyConsistent(t *testing.T) {
	skills, err := Skills()
	require.NoError(t, err)
	require.Len(t, skills, 20)
	require.Len(t, Experts(), 8)

	skillSlugs := make(map[string]struct{}, len(skills))
	for _, skill := range skills {
		require.NoError(t, slugkit.Validate(skill.Slug))
		require.NotEmpty(t, strings.TrimSpace(skill.Name))
		require.NotEmpty(t, skill.License)
		require.NotEmpty(t, skill.Tags)
		require.NotEmpty(t, strings.TrimSpace(skill.Instructions))
		require.NotContains(t, skill.Instructions, "TODO")
		require.NotContains(t, skillSlugs, skill.Slug)
		if skill.Slug == "learning-companion" {
			require.NotEmpty(t, skill.BundleFiles)
			paths := map[string]struct{}{}
			for _, file := range skill.BundleFiles {
				paths[file.Path] = struct{}{}
			}
			require.Contains(t, paths, "bin/start-domain-server.sh")
			require.Contains(t, paths, "program/server.py")
			require.Contains(t, paths, "program/run_domain_server.py")
			require.Contains(t, paths, "program/local_wiki.py")
		}
		skillSlugs[skill.Slug] = struct{}{}
		for _, source := range skill.ResearchSources {
			require.True(t, strings.HasPrefix(source.URL, "https://github.com/"))
			require.Len(t, source.Commit, 40)
			require.NotEmpty(t, source.License)
		}
	}
	expertSlugs := map[string]struct{}{}
	for _, expert := range Experts() {
		require.NoError(t, slugkit.Validate(expert.Slug))
		require.NotContains(t, expertSlugs, expert.Slug)
		expertSlugs[expert.Slug] = struct{}{}
		require.NotEmpty(t, expert.Category)
		require.NotEmpty(t, expert.Prompt)
		require.NotEmpty(t, expert.Outcomes)
		require.NotEmpty(t, expert.SkillSlugs)
		require.NotContains(t, expert.Name, "专家")
		for _, skillSlug := range expert.SkillSlugs {
			require.Contains(t, skillSlugs, skillSlug)
		}
	}
}
