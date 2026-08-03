package workerskill

import (
	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
)

type delta struct {
	added   []specdomain.SkillPackageBinding
	removed []string
}

// diffMounts keys on content SHA rather than slug so a slug whose package was
// re-pinned to different bytes still counts as a change the sandbox must apply.
func diffMounts(current, desired []specdomain.SkillPackageBinding) delta {
	currentBySlug := make(map[string]string, len(current))
	for _, binding := range current {
		currentBySlug[binding.Slug] = binding.ContentSHA
	}
	desiredSlugs := make(map[string]struct{}, len(desired))

	result := delta{}
	for _, binding := range desired {
		desiredSlugs[binding.Slug] = struct{}{}
		if sha, mounted := currentBySlug[binding.Slug]; !mounted || sha != binding.ContentSHA {
			result.added = append(result.added, binding)
		}
	}
	for _, binding := range current {
		if _, keep := desiredSlugs[binding.Slug]; !keep {
			result.removed = append(result.removed, binding.Slug)
		}
	}
	return result
}

func slugsOf(bindings []specdomain.SkillPackageBinding) []string {
	slugs := make([]string, 0, len(bindings))
	for _, binding := range bindings {
		slugs = append(slugs, binding.Slug)
	}
	return slugs
}
