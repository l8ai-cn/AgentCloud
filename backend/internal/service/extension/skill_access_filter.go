package extension

import "context"

func FilterAuthorizedResolvedSkills(
	ctx context.Context,
	gate SkillCatalogAccessGate,
	orgID, userID int64,
	role string,
	skills []*ResolvedSkill,
) ([]*ResolvedSkill, error) {
	if gate == nil || len(skills) == 0 {
		return skills, nil
	}
	ids := make([]int64, 0, len(skills))
	for _, skill := range skills {
		if skill != nil && skill.CatalogSkillID > 0 {
			ids = append(ids, skill.CatalogSkillID)
		}
	}
	allowed, err := gate.AllowedCatalogSkillIDs(ctx, orgID, userID, role, ids)
	if err != nil {
		return nil, err
	}
	if len(allowed) == len(ids) {
		return skills, nil
	}
	filtered := make([]*ResolvedSkill, 0, len(skills))
	for _, skill := range skills {
		if skill != nil {
			if _, ok := allowed[skill.CatalogSkillID]; ok {
				filtered = append(filtered, skill)
			}
		}
	}
	return filtered, nil
}

var _ SkillCatalogAccessGate = (*Service)(nil)
