package extension

import (
	"context"
	"slices"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	grantdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
)

const skillEntitlementKind = entitlementdom.KindSkill

type SkillGrantReader interface {
	GetGrantedUserIDs(ctx context.Context, resourceType, resourceID string) ([]int64, error)
}

type SkillEntitlementDecision struct {
	Allowed bool
}

type SkillEntitlementSnapshot interface {
	Decide(kind, key string, userID int64, role string) SkillEntitlementDecision
}

type SkillEntitlementGate interface {
	Require(ctx context.Context, orgID, userID int64, role, kind, key string) error
	SnapshotFor(ctx context.Context, orgID int64) (SkillEntitlementSnapshot, error)
}

func (s *Service) SetGrants(reader SkillGrantReader) {
	if s == nil {
		return
	}
	s.grants = reader
}

func (s *Service) SetEntitlements(gate SkillEntitlementGate) {
	if s == nil {
		return
	}
	s.entitlements = gate
}

func RequireSkillUse(
	ctx context.Context,
	entitlements SkillEntitlementGate,
	grants SkillGrantReader,
	orgID, userID int64,
	role string,
	row *skilldom.Skill,
) error {
	if row == nil {
		return ErrForbidden
	}
	if row.IsPlatformLevel() {
		if entitlements == nil {
			return nil
		}
		return entitlements.Require(ctx, orgID, userID, role, skillEntitlementKind, row.Slug)
	}
	return requireOrgSkillGrant(ctx, grants, userID, role, row.ID)
}

func requireOrgSkillGrant(
	ctx context.Context,
	grants SkillGrantReader,
	userID int64,
	role string,
	skillID int64,
) error {
	if grants == nil {
		return nil
	}
	grantedUserIDs, err := grants.GetGrantedUserIDs(
		ctx, grantdom.TypeSkill, grantdom.IntResourceID(skillID),
	)
	if err != nil {
		return err
	}
	if orgSkillUseAllowed(userID, role, grantedUserIDs) {
		return nil
	}
	return ErrForbidden
}

func orgSkillUseAllowed(userID int64, role string, grantedUserIDs []int64) bool {
	if len(grantedUserIDs) == 0 {
		return true
	}
	if role == organization.RoleOwner || role == organization.RoleAdmin {
		return true
	}
	return slices.Contains(grantedUserIDs, userID)
}

type SkillCatalogAccessGate interface {
	AllowedCatalogSkillIDs(context.Context, int64, int64, string, []int64) (map[int64]struct{}, error)
}

func SkillMountActor(ctx context.Context, fallbackUserID int64) (int64, string) {
	userID := fallbackUserID
	role := ""
	if tenant := middleware.GetTenant(ctx); tenant != nil {
		if tenant.UserID > 0 {
			userID = tenant.UserID
		}
		role = tenant.UserRole
	}
	return userID, role
}

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
