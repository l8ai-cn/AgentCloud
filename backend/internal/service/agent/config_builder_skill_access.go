package agent

import (
	"context"
	"fmt"

	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
)

func (b *ConfigBuilder) filterAuthorizedResolvedSkills(
	ctx context.Context,
	req *ConfigBuildRequest,
	skills []*extensionservice.ResolvedSkill,
) ([]*extensionservice.ResolvedSkill, error) {
	gate, ok := b.extensionProvider.(extensionservice.SkillCatalogAccessGate)
	if !ok {
		return skills, nil
	}
	userID, role := extensionservice.SkillMountActor(ctx, req.UserID)
	return extensionservice.FilterAuthorizedResolvedSkills(
		ctx, gate, req.OrganizationID, userID, role, skills,
	)
}

func (b *ConfigBuilder) filterWorkerSpecSkills(
	ctx context.Context,
	req *ConfigBuildRequest,
	skills []*extensionservice.ResolvedSkill,
	expected map[int64]struct{},
) ([]*extensionservice.ResolvedSkill, error) {
	filtered, err := b.filterAuthorizedResolvedSkills(ctx, req, skills)
	if err != nil {
		return nil, err
	}
	if len(filtered) == len(expected) {
		return filtered, nil
	}
	seen := make(map[int64]struct{}, len(filtered))
	for _, skill := range filtered {
		if skill != nil {
			seen[skill.CatalogSkillID] = struct{}{}
		}
	}
	for id := range expected {
		if _, ok := seen[id]; !ok {
			return nil, fmt.Errorf("required worker skill resolution is incomplete")
		}
	}
	return filtered, nil
}
