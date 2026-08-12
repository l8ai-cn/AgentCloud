package agent

import (
	"context"
	"fmt"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func (b *ConfigBuilder) buildPinnedWorkerSkillResources(
	ctx context.Context,
	req *ConfigBuildRequest,
	agentSlug string,
) ([]*runnerv1.ResourceToDownload, error) {
	provider, ok := b.extensionProvider.(WorkerSkillProvider)
	if !ok {
		return nil, fmt.Errorf("exact worker skill resolver is unavailable")
	}
	skills, err := provider.GetWorkerSkillsByPackages(
		ctx,
		req.RequiredSkillPackages,
		agentSlug,
	)
	if err != nil {
		return nil, fmt.Errorf("load pinned worker skills: %w", err)
	}
	if err := validatePinnedWorkerSkills(req.RequiredSkillPackages, skills); err != nil {
		return nil, err
	}
	skills, err = b.filterPinnedWorkerSkills(ctx, req, skills)
	if err != nil {
		return nil, err
	}
	return skillResources(agentSlug, skills, true)
}

// A pinned package is part of an immutable worker snapshot, but revocation has
// to outrank snapshot replayability: relaunching a worker must not remount a
// skill the owner has since lost access to. Failing loudly beats silently
// dropping a skill the agent depends on.
func (b *ConfigBuilder) filterPinnedWorkerSkills(
	ctx context.Context,
	req *ConfigBuildRequest,
	skills []*extensionservice.ResolvedSkill,
) ([]*extensionservice.ResolvedSkill, error) {
	filtered, err := b.filterAuthorizedResolvedSkills(ctx, req, skills)
	if err != nil {
		return nil, err
	}
	if len(filtered) == len(skills) {
		return filtered, nil
	}
	allowed := make(map[int64]struct{}, len(filtered))
	for _, skill := range filtered {
		if skill != nil {
			allowed[skill.CatalogSkillID] = struct{}{}
		}
	}
	for _, skill := range skills {
		if skill == nil {
			continue
		}
		if _, ok := allowed[skill.CatalogSkillID]; !ok {
			return nil, fmt.Errorf(
				"pinned worker skill %q (%d) is no longer authorized for user %d",
				skill.Slug,
				skill.CatalogSkillID,
				req.UserID,
			)
		}
	}
	return filtered, nil
}

func validatePinnedWorkerSkills(
	packages []specdomain.SkillPackageBinding,
	skills []*extensionservice.ResolvedSkill,
) error {
	expected := make(map[int64]specdomain.SkillPackageBinding, len(packages))
	for _, pkg := range packages {
		expected[pkg.SkillID] = pkg
	}
	for _, skill := range skills {
		if skill == nil {
			return fmt.Errorf("pinned worker skill resolution returned nil")
		}
		pkg, exists := expected[skill.CatalogSkillID]
		if !exists || skill.Slug != pkg.Slug ||
			skill.ContentSha != pkg.ContentSHA ||
			skill.PackageSize != pkg.PackageSize {
			return fmt.Errorf(
				"pinned worker skill %d does not match snapshot",
				skill.CatalogSkillID,
			)
		}
		delete(expected, skill.CatalogSkillID)
	}
	if len(expected) != 0 {
		return fmt.Errorf("pinned worker skill resolution is incomplete")
	}
	return nil
}
