package imbridge

import (
	"context"
	"encoding/json"
	"net/http"
)

// InboundEvent is the normalized message shape after a provider parses inbound traffic.
type InboundEvent struct {
	ExternalMessageID string
	ExternalThreadID  string
	ExternalUserID    string
	SenderName        string
	Text              string
	Challenge         string // URL verification handshake (Feishu/Slack)
	ContextToken      string // Weixin iLink reply token
}

// OutboundMessage is the normalized outbound payload for collaboration channels.
type OutboundMessage struct {
	ExternalThreadID string
	Text             string
	SenderLabel      string
	ContextToken     string // Weixin iLink reply token
	ReplaceMessageID string // when set, prefer in-place edit (progress draft)
}

// Provider implements one IM platform. Registry pattern mirrors OpenClaw
// channel plugins — add providers without touching the core bridge service.
type Provider interface {
	Type() string
	DisplayName() string
	ValidateConfig(raw json.RawMessage) error
	VerifyWebhook(ctx context.Context, cfg json.RawMessage, headers http.Header, body []byte) error
	ParseInbound(ctx context.Context, cfg json.RawMessage, headers http.Header, body []byte) (*InboundEvent, error)
	SendOutbound(ctx context.Context, cfg json.RawMessage, msg OutboundMessage) error
}

// OutboundTracker is optional: platforms that can return/edit message IDs
// (Feishu patch, DingTalk AI Card) implement progress drafts.
type OutboundTracker interface {
	SendOutboundTracked(ctx context.Context, cfg json.RawMessage, msg OutboundMessage) (messageID string, err error)
	UpdateOutbound(ctx context.Context, cfg json.RawMessage, msg OutboundMessage) error
}
