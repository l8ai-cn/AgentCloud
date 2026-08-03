package workerskill

import (
	"context"
	"encoding/json"
	"fmt"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

// pinSkills mirrors the creation-time checks in workercreation.resolveSkill so a
// remount can never mount something the create wizard would have rejected.
func (r *Remounter) pinSkills(
	ctx context.Context,
	organizationID int64,
	workerTypeSlug string,
	ids []int64,
) ([]specdomain.SkillPackageBinding, error) {
	seen := make(map[int64]struct{}, len(ids))
	bindings := make([]specdomain.SkillPackageBinding, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, fmt.Errorf("%w: skill id must be positive", ErrInvalidSkillSelection)
		}
		if _, duplicate := seen[id]; duplicate {
			return nil, fmt.Errorf("%w: duplicate skill id %d", ErrInvalidSkillSelection, id)
		}
		seen[id] = struct{}{}

		row, err := r.catalog.GetAnyByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("%w: skill %d not found", ErrInvalidSkillSelection, id)
		}
		if row == nil || row.ID != id || !row.IsActive || !row.VisibleTo(organizationID) {
			return nil, fmt.Errorf("%w: skill %d is not accessible", ErrInvalidSkillSelection, id)
		}
		if err := slugkit.Validate(row.Slug); err != nil {
			return nil, fmt.Errorf("%w: skill %d slug: %v", ErrInvalidSkillSelection, id, err)
		}
		if row.ContentSha == "" || row.StorageKey == "" {
			return nil, fmt.Errorf("%w: skill %d has no package", ErrInvalidSkillSelection, id)
		}
		allowed, err := skillAllowsWorker(row.AgentFilter, workerTypeSlug)
		if err != nil {
			return nil, fmt.Errorf("%w: skill %d agent filter: %v", ErrInvalidSkillSelection, id, err)
		}
		if !allowed {
			return nil, fmt.Errorf(
				"%w: skill %s does not support worker type %s",
				ErrInvalidSkillSelection, row.Slug, workerTypeSlug,
			)
		}
		bindings = append(bindings, specdomain.SkillPackageBinding{
			SkillID:     row.ID,
			Slug:        row.Slug,
			Version:     row.Version,
			ContentSHA:  row.ContentSha,
			StorageKey:  row.StorageKey,
			PackageSize: row.PackageSize,
		})
	}
	return bindings, nil
}

func skillAllowsWorker(agentFilter json.RawMessage, workerTypeSlug string) (bool, error) {
	if len(agentFilter) == 0 {
		return true, nil
	}
	var filter []string
	if err := json.Unmarshal(agentFilter, &filter); err != nil {
		return false, fmt.Errorf("agent filter is not a string list")
	}
	if len(filter) == 0 {
		return true, nil
	}
	for _, allowed := range filter {
		if allowed == workerTypeSlug {
			return true, nil
		}
	}
	return false, nil
}
