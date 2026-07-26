package imbridge

import (
	"encoding/json"
	"time"
)

const (
	ProviderFeishu   = "feishu"
	ProviderDingTalk = "dingtalk"
	ProviderWeCom    = "wecom"
	ProviderSlack    = "slack"
	ProviderWeixin   = "weixin"
	ProviderWeChat   = "wechat"
)

const (
	StatusDisabled = "disabled"
	StatusActive   = "active"
	StatusError    = "error"
)

const (
	DMPolicyPairing   = "pairing"
	DMPolicyOpen      = "open"
	DMPolicyAllowlist = "allowlist"
	DMPolicyDisabled  = "disabled"
	DMPolicyGuest     = "guest"

	GroupPolicyOpen      = "open"
	GroupPolicyAllowlist = "allowlist"
	GroupPolicyDisabled  = "disabled"

	PeerDirect = "direct"
	PeerGroup  = "group"
	PeerAny    = "any"

	TargetPod     = "pod"
	TargetExpert  = "expert"
	TargetChannel = "channel"

	BindingPending = "pending"
	BindingBound   = "bound"
	BindingBlocked = "blocked"

	LocaleEnglish = "en"
	LocaleChinese = "zh-CN"
)

var SupportedLocales = []string{LocaleEnglish, LocaleChinese}

var SupportedProviders = []string{
	ProviderFeishu,
	ProviderDingTalk,
	ProviderWeCom,
	ProviderSlack,
	ProviderWeixin,
}

type Connection struct {
	ID              int64           `gorm:"primaryKey" json:"id"`
	OrganizationID  int64           `gorm:"not null;index" json:"organization_id"`
	Provider        string          `gorm:"size:32;not null" json:"provider"`
	Name            string          `gorm:"size:255;not null" json:"name"`
	ChannelID       *int64          `json:"channel_id,omitempty"`
	Config          json.RawMessage `gorm:"type:jsonb;not null;default:'{}'" json:"config"`
	ConfigEncrypted *string         `gorm:"type:text" json:"-"`
	WebhookToken    string          `gorm:"size:64;not null" json:"-"`
	Status          string          `gorm:"size:32;not null;default:'disabled'" json:"status"`
	Transport       string          `gorm:"size:16;not null;default:'webhook'" json:"transport"`
	DMPolicy        string          `gorm:"size:16;not null;default:'pairing'" json:"dm_policy"`
	GroupPolicy     string          `gorm:"size:16;not null;default:'allowlist'" json:"group_policy"`
	AllowFrom       json.RawMessage `gorm:"type:jsonb;not null;default:'[]'" json:"allow_from"`
	StreamingMode   string          `gorm:"size:16;not null;default:'progress'" json:"streaming_mode"`
	Locale          string          `gorm:"size:16;not null;default:'zh-CN'" json:"locale"`
	LastSeenAt      *time.Time      `json:"last_seen_at,omitempty"`
	LastError       *string         `gorm:"type:text" json:"last_error,omitempty"`
	CreatedByUserID int64           `gorm:"not null" json:"created_by_user_id"`
	CreatedAt       time.Time       `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt       time.Time       `gorm:"not null;default:now()" json:"updated_at"`

	WebhookURL string `gorm:"-" json:"webhook_url,omitempty"`
}

type ThreadMapping struct {
	ID               int64     `gorm:"primaryKey" json:"id"`
	ConnectionID     int64     `gorm:"not null;index" json:"connection_id"`
	ExternalThreadID string    `gorm:"size:512;not null" json:"external_thread_id"`
	ChannelID        int64     `gorm:"not null;index" json:"channel_id"`
	ContextToken     *string   `gorm:"size:512" json:"context_token,omitempty"`
	PeerKind         string    `gorm:"size:16;not null;default:'group'" json:"peer_kind"`
	ActiveTargetRef  *string   `gorm:"size:255" json:"active_target_ref,omitempty"`
	DraftMessageID   *string   `gorm:"size:255" json:"draft_message_id,omitempty"`
	CreatedAt        time.Time `gorm:"not null;default:now()" json:"created_at"`
}

type IdentityBinding struct {
	ID               int64      `gorm:"primaryKey" json:"id"`
	ConnectionID     int64      `gorm:"not null;index" json:"connection_id"`
	ExternalUserID   string     `gorm:"size:255;not null" json:"external_user_id"`
	ExternalName     *string    `gorm:"size:255" json:"external_name,omitempty"`
	UserID           *int64     `json:"user_id,omitempty"`
	Status           string     `gorm:"size:20;not null;default:'pending'" json:"status"`
	PairingCode      *string    `gorm:"size:16" json:"pairing_code,omitempty"`
	PairingExpiresAt *time.Time `json:"pairing_expires_at,omitempty"`
	CreatedAt        time.Time  `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt        time.Time  `gorm:"not null;default:now()" json:"updated_at"`
}

type RouteBinding struct {
	ID             int64     `gorm:"primaryKey" json:"id"`
	ConnectionID   int64     `gorm:"not null;index" json:"connection_id"`
	PeerKind       string    `gorm:"size:16;not null" json:"peer_kind"`
	PeerID         *string   `gorm:"size:512" json:"peer_id,omitempty"`
	TargetKind     string    `gorm:"size:16;not null" json:"target_kind"`
	TargetRef      string    `gorm:"size:255;not null" json:"target_ref"`
	RequireMention bool      `gorm:"not null;default:false" json:"require_mention"`
	Priority       int       `gorm:"not null;default:100" json:"priority"`
	CreatedAt      time.Time `gorm:"not null;default:now()" json:"created_at"`
}

func (Connection) TableName() string      { return "im_channel_connections" }
func (ThreadMapping) TableName() string   { return "im_thread_mappings" }
func (IdentityBinding) TableName() string { return "im_identity_bindings" }
func (RouteBinding) TableName() string    { return "im_route_bindings" }
