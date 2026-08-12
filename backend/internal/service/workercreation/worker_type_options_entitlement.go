package workercreation

import (
	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
)

func workerTypeListEntitlement(
	snap entitlementsvc.Snapshot,
	slug string,
	userID int64,
	role string,
) (include bool, blocking BlockingReason) {
	if snap == nil {
		return true, ""
	}
	decision := decideWorkerTypeEntitlement(snap, slug, userID, role)
	if platformEntitlementDenied(decision) {
		return false, ""
	}
	if !decision.Allowed && decision.Reason == entitlementdom.DenyNotGranted {
		return true, BlockingNotEntitled
	}
	return true, ""
}
