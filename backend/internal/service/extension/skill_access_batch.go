package extension

import (
	"context"
	"fmt"

	grantdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
)

type skillAccessBatch struct {
	entSnap    SkillEntitlementSnapshot
	restricted map[int64][]int64
	userID     int64
	role       string
}

func newSkillAccessBatch(
	ctx context.Context,
	entitlements SkillEntitlementGate,
	grants SkillGrantReader,
	orgID, userID int64,
	role string,
	rows []*skilldom.Skill,
) (*skillAccessBatch, error) {
	batch := &skillAccessBatch{restricted: map[int64][]int64{}, userID: userID, role: role}
	if entitlements != nil {
		snap, err := entitlements.SnapshotFor(ctx, orgID)
		if err != nil {
			return nil, err
		}
		batch.entSnap = snap
	}
	if grants != nil {
		seen := make(map[int64]struct{}, len(rows))
		for _, row := range rows {
			if row == nil || row.IsPlatformLevel() {
				continue
			}
			if _, dup := seen[row.ID]; dup {
				continue
			}
			seen[row.ID] = struct{}{}
			grantedUserIDs, err := grants.GetGrantedUserIDs(
				ctx, grantdom.TypeSkill, grantdom.IntResourceID(row.ID),
			)
			if err != nil {
				return nil, err
			}
			if len(grantedUserIDs) > 0 {
				batch.restricted[row.ID] = grantedUserIDs
			}
		}
	}
	return batch, nil
}

func (b *skillAccessBatch) allows(row *skilldom.Skill) bool {
	if row == nil {
		return false
	}
	if row.IsPlatformLevel() {
		if b.entSnap == nil {
			return true
		}
		return b.entSnap.Decide(skillEntitlementKind, row.Slug, b.userID, b.role).Allowed
	}
	grantedUserIDs, restricted := b.restricted[row.ID]
	if !restricted {
		return true
	}
	return orgSkillUseAllowed(b.userID, b.role, grantedUserIDs)
}

func (s *Service) AllowedCatalogSkillIDs(
	ctx context.Context,
	orgID, userID int64,
	role string,
	ids []int64,
) (map[int64]struct{}, error) {
	allowed := make(map[int64]struct{}, len(ids))
	if len(ids) == 0 {
		return allowed, nil
	}
	if s.entitlements == nil && s.grants == nil {
		for _, id := range ids {
			allowed[id] = struct{}{}
		}
		return allowed, nil
	}
	if s.catalog == nil {
		return nil, fmt.Errorf("%w: skill catalog not configured", ErrInvalidInput)
	}
	rows := make([]*skilldom.Skill, 0, len(ids))
	for _, id := range ids {
		row, err := s.catalog.GetAnyByID(ctx, id)
		if err != nil {
			return nil, err
		}
		if row == nil || row.ID != id {
			continue
		}
		rows = append(rows, row)
	}
	batch, err := newSkillAccessBatch(ctx, s.entitlements, s.grants, orgID, userID, role, rows)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if batch.allows(row) {
			allowed[row.ID] = struct{}{}
		}
	}
	return allowed, nil
}

var _ SkillCatalogAccessGate = (*Service)(nil)
