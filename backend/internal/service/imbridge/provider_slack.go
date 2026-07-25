package imbridge

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type SlackProvider struct{ HTTP *http.Client }

func (p *SlackProvider) Type() string        { return domain.ProviderSlack }
func (p *SlackProvider) DisplayName() string { return "Slack" }

type slackBridgeConfig struct {
	SigningSecret  string `json:"signing_secret"`
	BotToken       string `json:"bot_token"`
	DefaultChannel string `json:"default_channel,omitempty"`
}

func (p *SlackProvider) ValidateConfig(raw json.RawMessage) error {
	var cfg slackBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.SigningSecret == "" || cfg.BotToken == "" {
		return errors.New("slack requires signing_secret and bot_token")
	}
	return nil
}

func (p *SlackProvider) VerifyWebhook(_ context.Context, raw json.RawMessage, headers http.Header, body []byte) error {
	var cfg slackBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	ts := headers.Get("X-Slack-Request-Timestamp")
	sig := headers.Get("X-Slack-Signature")
	if ts == "" || sig == "" {
		return nil
	}
	if age := time.Since(time.Unix(parseInt64(ts), 0)); age > 5*time.Minute || age < -5*time.Minute {
		return errors.New("slack timestamp out of range")
	}
	base := "v0:" + ts + ":" + string(body)
	mac := hmac.New(sha256.New, []byte(cfg.SigningSecret))
	mac.Write([]byte(base))
	expected := "v0=" + hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(sig)) {
		return errors.New("slack signature mismatch")
	}
	return nil
}

func (p *SlackProvider) ParseInbound(_ context.Context, _ json.RawMessage, _ http.Header, body []byte) (*InboundEvent, error) {
	var payload struct {
		Type      string `json:"type"`
		Challenge string `json:"challenge"`
		EventID   string `json:"event_id"`
		Event     struct {
			Type    string `json:"type"`
			User    string `json:"user"`
			Text    string `json:"text"`
			Channel string `json:"channel"`
			TS      string `json:"ts"`
		} `json:"event"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	if payload.Challenge != "" {
		return &InboundEvent{Challenge: payload.Challenge}, nil
	}
	msgID := payload.Event.TS
	if msgID == "" {
		msgID = payload.EventID
	}
	return &InboundEvent{
		ExternalMessageID: msgID,
		ExternalThreadID:  payload.Event.Channel,
		ExternalUserID:    payload.Event.User,
		SenderName:        payload.Event.User,
		Text:              strings.TrimSpace(payload.Event.Text),
	}, nil
}

func (p *SlackProvider) SendOutbound(ctx context.Context, raw json.RawMessage, msg OutboundMessage) error {
	var cfg slackBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	channel := msg.ExternalThreadID
	if channel == "" {
		channel = cfg.DefaultChannel
	}
	return doJSONRequest(ctx, p.client(), http.MethodPost, "https://slack.com/api/chat.postMessage",
		map[string]string{"Authorization": "Bearer " + cfg.BotToken},
		map[string]any{"channel": channel, "text": msg.Text}, nil)
}

func (p *SlackProvider) client() *http.Client { return (&httpJSON{HTTP: p.HTTP}).client() }
