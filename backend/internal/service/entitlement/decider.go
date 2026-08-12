package entitlement

import (
	"time"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
)

func decide(
	now time.Time,
	defaultPolicy string,
	records []entitlementdom.Entitlement,
	userID int64,
	role string,
) entitlementdom.Decision {
	var orgDeny, orgAllow, userDenied, userAllowed, allowListArmed bool
	for _, row := range records {
		if !row.LiveAt(now) {
			continue
		}
		targeted := row.SubjectUserID != nil && *row.SubjectUserID == userID
		switch {
		case row.SubjectKind == entitlementdom.SubjectOrg:
			orgDeny = orgDeny || row.Effect == entitlementdom.EffectDeny
			orgAllow = orgAllow || row.Effect == entitlementdom.EffectAllow
		case row.Effect == entitlementdom.EffectDeny:
			userDenied = userDenied || targeted
		case row.Effect == entitlementdom.EffectAllow:
			// Only allow rows arm the allow-list. If deny rows armed it too,
			// blocking one member would silently cut off the whole org.
			allowListArmed = true
			userAllowed = userAllowed || targeted
		}
	}
	if orgDeny {
		return entitlementdom.Deny(entitlementdom.DenyPlatformRevoked)
	}
	if !orgAllow && defaultPolicy == DefaultClosed {
		return entitlementdom.Deny(entitlementdom.DenyNotEntitled)
	}
	if userDenied {
		return entitlementdom.Deny(entitlementdom.DenyNotGranted)
	}
	if userAllowed || !allowListArmed {
		return entitlementdom.Allow()
	}
	if role == organization.RoleOwner || role == organization.RoleAdmin {
		return entitlementdom.Allow()
	}
	return entitlementdom.Deny(entitlementdom.DenyNotGranted)
}
