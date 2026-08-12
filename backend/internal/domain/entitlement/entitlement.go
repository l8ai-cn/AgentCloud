package entitlement

import (
	"time"

	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	"gorm.io/gorm"
)

const (
	KindWorkerType = "worker_type"
	KindSkill      = "skill"

	EffectAllow = "allow"
	EffectDeny  = "deny"

	SubjectOrg  = "org"
	SubjectUser = "user"
)

type Entitlement struct {
	ID             int64      `gorm:"primaryKey" json:"id"`
	ResourceKind   string     `gorm:"size:32;not null" json:"resource_kind"`
	ResourceKey    string     `gorm:"size:100;not null" json:"resource_key"`
	OrganizationID int64      `gorm:"not null;index" json:"organization_id"`
	SubjectKind    string     `gorm:"size:16;not null;default:org" json:"subject_kind"`
	SubjectUserID  *int64     `json:"subject_user_id,omitempty"`
	Effect         string     `gorm:"size:8;not null;default:allow" json:"effect"`
	Reason         string     `gorm:"not null;default:''" json:"reason"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	GrantedBy      int64      `gorm:"not null" json:"granted_by"`
	CreatedAt      time.Time  `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"not null;default:now()" json:"updated_at"`
}

func (Entitlement) TableName() string { return "resource_entitlements" }

func (e *Entitlement) BeforeSave(_ *gorm.DB) error {
	return slugkit.ValidateIdentifier("resource_entitlements.resource_key", e.ResourceKey)
}

func (e Entitlement) LiveAt(now time.Time) bool {
	return e.ExpiresAt == nil || e.ExpiresAt.After(now)
}
