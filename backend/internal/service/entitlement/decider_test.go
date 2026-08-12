package entitlement

import (
	"testing"
	"time"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/stretchr/testify/assert"
)

func TestDecide(t *testing.T) {
	now := time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC)
	expired := now.Add(-time.Hour)
	future := now.Add(time.Hour)
	member := int64(7)
	other := int64(8)

	tests := []struct {
		name    string
		def     string
		records []entitlementdom.Entitlement
		userID  int64
		role    string
		want    entitlementdom.Decision
	}{
		{
			name: "platform deny wins over org allow and user allow",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				orgRecord(entitlementdom.EffectDeny, nil),
				orgRecord(entitlementdom.EffectAllow, nil),
				userRecord(member, entitlementdom.EffectAllow, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Deny(entitlementdom.DenyPlatformRevoked),
		},
		{
			name: "expired platform deny is ignored",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				orgRecord(entitlementdom.EffectDeny, &expired),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Allow(),
		},
		{
			name:   "default closed with no org record",
			def:    DefaultClosed,
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Deny(entitlementdom.DenyNotEntitled),
		},
		{
			name: "default closed with org allow and no user rows",
			def:  DefaultClosed,
			records: []entitlementdom.Entitlement{
				orgRecord(entitlementdom.EffectAllow, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Allow(),
		},
		{
			name:   "default open with no records",
			def:    DefaultOpen,
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Allow(),
		},
		{
			name: "presence-is-whitelist: listed user allowed",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(member, entitlementdom.EffectAllow, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Allow(),
		},
		{
			name: "presence-is-whitelist: unlisted member denied",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(other, entitlementdom.EffectAllow, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Deny(entitlementdom.DenyNotGranted),
		},
		{
			name: "admin bypasses whitelist",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(other, entitlementdom.EffectAllow, nil),
			},
			userID: member, role: organization.RoleAdmin,
			want: entitlementdom.Allow(),
		},
		{
			name: "owner bypasses whitelist",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(other, entitlementdom.EffectAllow, nil),
			},
			userID: member, role: organization.RoleOwner,
			want: entitlementdom.Allow(),
		},
		{
			name: "admin cannot bypass platform deny",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				orgRecord(entitlementdom.EffectDeny, nil),
			},
			userID: member, role: organization.RoleOwner,
			want: entitlementdom.Deny(entitlementdom.DenyPlatformRevoked),
		},
		{
			name:   "admin cannot bypass default closed",
			def:    DefaultClosed,
			userID: member, role: organization.RoleAdmin,
			want: entitlementdom.Deny(entitlementdom.DenyNotEntitled),
		},
		{
			name: "expired user rows do not enter whitelist mode",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(other, entitlementdom.EffectAllow, &expired),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Allow(),
		},
		{
			name: "expired user allow does not match in whitelist mode",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(member, entitlementdom.EffectAllow, &expired),
				userRecord(other, entitlementdom.EffectAllow, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Deny(entitlementdom.DenyNotGranted),
		},
		{
			name: "expired org allow falls back to default closed",
			def:  DefaultClosed,
			records: []entitlementdom.Entitlement{
				orgRecord(entitlementdom.EffectAllow, &expired),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Deny(entitlementdom.DenyNotEntitled),
		},
		{
			name: "org allow plus whitelist",
			def:  DefaultClosed,
			records: []entitlementdom.Entitlement{
				orgRecord(entitlementdom.EffectAllow, &future),
				userRecord(member, entitlementdom.EffectAllow, &future),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Allow(),
		},
		{
			name: "org allow plus whitelist misses other member",
			def:  DefaultClosed,
			records: []entitlementdom.Entitlement{
				orgRecord(entitlementdom.EffectAllow, nil),
				userRecord(other, entitlementdom.EffectAllow, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Deny(entitlementdom.DenyNotGranted),
		},
		{
			name: "user deny blocks only its target",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(other, entitlementdom.EffectDeny, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Allow(),
		},
		{
			name: "user deny denies its target",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(member, entitlementdom.EffectDeny, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Deny(entitlementdom.DenyNotGranted),
		},
		{
			name: "user deny outranks admin bypass",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(member, entitlementdom.EffectDeny, nil),
			},
			userID: member, role: organization.RoleAdmin,
			want: entitlementdom.Deny(entitlementdom.DenyNotGranted),
		},
		{
			name: "user deny outranks an explicit allow for the same user",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(member, entitlementdom.EffectAllow, nil),
				userRecord(member, entitlementdom.EffectDeny, nil),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Deny(entitlementdom.DenyNotGranted),
		},
		{
			name: "expired user deny is ignored",
			def:  DefaultOpen,
			records: []entitlementdom.Entitlement{
				userRecord(member, entitlementdom.EffectDeny, &expired),
			},
			userID: member, role: organization.RoleMember,
			want: entitlementdom.Allow(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := decide(now, tt.def, tt.records, tt.userID, tt.role)
			assert.Equal(t, tt.want, got)
		})
	}
}

func orgRecord(effect string, expires *time.Time) entitlementdom.Entitlement {
	return entitlementdom.Entitlement{
		SubjectKind: entitlementdom.SubjectOrg,
		Effect:      effect,
		ExpiresAt:   expires,
	}
}

func userRecord(userID int64, effect string, expires *time.Time) entitlementdom.Entitlement {
	return entitlementdom.Entitlement{
		SubjectKind:   entitlementdom.SubjectUser,
		SubjectUserID: &userID,
		Effect:        effect,
		ExpiresAt:     expires,
	}
}
