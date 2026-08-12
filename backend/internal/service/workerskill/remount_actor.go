package workerskill

import (
	"context"

	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
)

type SkillEntitlementGate = extensionservice.SkillEntitlementGate

type SkillGrantReader = extensionservice.SkillGrantReader

type MemberRoleReader interface {
	GetMemberRole(ctx context.Context, orgID, userID int64) (string, error)
}

func (r *Remounter) SetEntitlements(gate SkillEntitlementGate) {
	if r == nil {
		return
	}
	r.entitlements = gate
}

func (r *Remounter) SetGrants(reader SkillGrantReader) {
	if r == nil {
		return
	}
	r.grants = reader
}

func (r *Remounter) SetMemberRoles(reader MemberRoleReader) {
	if r == nil {
		return
	}
	r.memberRoles = reader
}

func (r *Remounter) remountActor(ctx context.Context, orgID int64) (int64, string) {
	userID, role := extensionservice.SkillMountActor(ctx, 0)
	if role != "" || r == nil || r.memberRoles == nil {
		return userID, role
	}
	memberRole, err := r.memberRoles.GetMemberRole(ctx, orgID, userID)
	if err != nil {
		return userID, role
	}
	return userID, memberRole
}
