package extension

import (
	"context"

	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
)

func AdaptEntitlementService(svc *entitlementsvc.Service) SkillEntitlementGate {
	if svc == nil {
		return nil
	}
	return entitlementServiceGate{svc: svc}
}

type entitlementServiceGate struct {
	svc *entitlementsvc.Service
}

func (g entitlementServiceGate) Require(
	ctx context.Context,
	orgID, userID int64,
	role, kind, key string,
) error {
	return g.svc.Require(ctx, orgID, userID, role, kind, key)
}

func (g entitlementServiceGate) SnapshotFor(
	ctx context.Context,
	orgID int64,
) (SkillEntitlementSnapshot, error) {
	snap, err := g.svc.SnapshotFor(ctx, orgID)
	if err != nil || snap == nil {
		return nil, err
	}
	return entitlementSnapshotAdapter{snap}, nil
}

type entitlementSnapshotAdapter struct {
	snap entitlementsvc.Snapshot
}

func (a entitlementSnapshotAdapter) Decide(
	kind, key string,
	userID int64,
	role string,
) SkillEntitlementDecision {
	decision := a.snap.Decide(kind, key, userID, role)
	return SkillEntitlementDecision{Allowed: decision.Allowed}
}
