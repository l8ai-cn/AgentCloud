package imbridge

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type DingTalkProvider struct{ HTTP *http.Client }

func (p *DingTalkProvider) Type() string        { return domain.ProviderDingTalk }
func (p *DingTalkProvider) DisplayName() string { return "钉钉" }

type dingTalkBridgeConfig struct {
	AppKey        string `json:"app_key"`
	AppSecret     string `json:"app_secret"`
	SigningSecret string `json:"signing_secret"`
	WebhookURL    string `json:"webhook_url,omitempty"`
}

func (p *DingTalkProvider) ValidateConfig(raw json.RawMessage) error {
	var cfg dingTalkBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.AppKey == "" || cfg.AppSecret == "" {
		return errors.New("dingtalk requires app_key and app_secret")
	}
	return nil
}

// Custom-robot HTTP callback signature: base64(HMAC-SHA256(secret, timestamp+"\n"+secret)).
// Stream mode does not use this path.
func (p *DingTalkProvider) VerifyWebhook(_ context.Context, raw json.RawMessage, headers http.Header, _ []byte) error {
	var cfg dingTalkBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	secret := cfg.SigningSecret
	if secret == "" {
		secret = cfg.AppSecret
	}
	ts := headers.Get("timestamp")
	sign := headers.Get("sign")
	if ts == "" || sign == "" {
		return nil
	}
	if secret == "" {
		return errors.New("dingtalk signature present but no signing secret configured")
	}
	expected := dingtalkSign(ts, secret)
	if sign != expected {
		return errors.New("dingtalk signature mismatch")
	}
	return nil
}

func dingtalkSign(timestamp, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "\n" + secret))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func (p *DingTalkProvider) ParseInbound(_ context.Context, _ json.RawMessage, _ http.Header, body []byte) (*InboundEvent, error) {
	var payload struct {
		MsgID            string `json:"msgId"`
		ConversationID   string `json:"conversationId"`
		ConversationType string `json:"conversationType"`
		Text             struct {
			Content string `json:"content"`
		} `json:"text"`
		SenderNick    string `json:"senderNick"`
		SenderID      string `json:"senderId"`
		SenderStaffID string `json:"senderStaffId"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	thread := payload.ConversationID
	if thread == "" {
		thread = payload.ConversationType
	}
	userID := strings.TrimSpace(payload.SenderStaffID)
	if userID == "" {
		userID = strings.TrimSpace(payload.SenderID)
	}
	return &InboundEvent{
		ExternalMessageID: payload.MsgID,
		ExternalThreadID:  thread,
		ExternalUserID:    userID,
		SenderName:        payload.SenderNick,
		Text:              strings.TrimSpace(payload.Text.Content),
	}, nil
}

func (p *DingTalkProvider) SendOutbound(ctx context.Context, raw json.RawMessage, msg OutboundMessage) error {
	var cfg dingTalkBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.WebhookURL != "" {
		return doJSONRequest(ctx, p.client(), http.MethodPost, cfg.WebhookURL, nil, map[string]any{
			"msgtype": "text",
			"text":    map[string]string{"content": msg.Text},
		}, nil)
	}
	token, err := p.accessToken(ctx, cfg)
	if err != nil {
		return err
	}
	return doJSONRequest(ctx, p.client(), http.MethodPost,
		"https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend",
		map[string]string{"x-acs-dingtalk-access-token": token},
		map[string]any{
			"robotCode": cfg.AppKey,
			"userIds":   []string{msg.ExternalThreadID},
			"msgKey":    "sampleText",
			"msgParam":  map[string]string{"content": msg.Text},
		}, nil)
}

func (p *DingTalkProvider) accessToken(ctx context.Context, cfg dingTalkBridgeConfig) (string, error) {
	var out struct {
		AccessToken string `json:"accessToken"`
	}
	const u = "https://api.dingtalk.com/v1.0/oauth2/accessToken"
	err := doJSONRequest(ctx, p.client(), http.MethodPost, u, nil, map[string]string{
		"appKey": cfg.AppKey, "appSecret": cfg.AppSecret,
	}, &out)
	if err != nil {
		return "", err
	}
	return out.AccessToken, nil
}

func (p *DingTalkProvider) client() *http.Client { return (&httpJSON{HTTP: p.HTTP}).client() }
