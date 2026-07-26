package imbridge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type FeishuProvider struct {
	HTTP   *http.Client
	tokens *tokenCache
}

func (p *FeishuProvider) Type() string        { return domain.ProviderFeishu }
func (p *FeishuProvider) DisplayName() string { return "飞书" }

type feishuBridgeConfig struct {
	AppID             string `json:"app_id"`
	AppSecret         string `json:"app_secret"`
	VerificationToken string `json:"verification_token"`
	EncryptKey        string `json:"encrypt_key,omitempty"`
	DefaultChatID     string `json:"default_chat_id,omitempty"`
}

func (p *FeishuProvider) ValidateConfig(raw json.RawMessage) error {
	var cfg feishuBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.AppID == "" || cfg.AppSecret == "" || cfg.VerificationToken == "" {
		return errors.New("feishu requires app_id, app_secret, verification_token")
	}
	return nil
}

func (p *FeishuProvider) VerifyWebhook(_ context.Context, raw json.RawMessage, headers http.Header, body []byte) error {
	var cfg feishuBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	decoded, err := decodeFeishuRequestBody(cfg, headers, body)
	if err != nil {
		return err
	}
	var envelope struct {
		Token     string `json:"token"`
		Type      string `json:"type"`
		Challenge string `json:"challenge"`
		Header    struct {
			Token string `json:"token"`
		} `json:"header"`
	}
	if err := json.Unmarshal(decoded, &envelope); err != nil {
		return err
	}
	token := envelope.Token
	if token == "" {
		token = envelope.Header.Token
	}
	if token == "" {
		// The URL-verification handshake carries no event payload and cannot
		// reach a worker, so it stays acceptable without a token.
		if envelope.Type == "url_verification" && envelope.Challenge != "" {
			return nil
		}
		return errors.New("feishu payload missing verification token")
	}
	if token != cfg.VerificationToken {
		return errors.New("feishu verification token mismatch")
	}
	return nil
}

func (p *FeishuProvider) ParseInbound(_ context.Context, raw json.RawMessage, headers http.Header, body []byte) (*InboundEvent, error) {
	var cfg feishuBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, err
	}
	decoded, err := decodeFeishuRequestBody(cfg, headers, body)
	if err != nil {
		return nil, err
	}
	var envelope struct {
		Challenge string `json:"challenge"`
		Type      string `json:"type"`
		Header    struct {
			EventType string `json:"event_type"`
			EventID   string `json:"event_id"`
		} `json:"header"`
		Event struct {
			Message struct {
				MessageID string `json:"message_id"`
				ChatID    string `json:"chat_id"`
				Content   string `json:"content"`
			} `json:"message"`
			Sender struct {
				SenderID struct {
					OpenID string `json:"open_id"`
				} `json:"sender_id"`
			} `json:"sender"`
		} `json:"event"`
	}
	if err := json.Unmarshal(decoded, &envelope); err != nil {
		return nil, err
	}
	if envelope.Challenge != "" {
		return &InboundEvent{Challenge: envelope.Challenge}, nil
	}
	text := envelope.Event.Message.Content
	var content struct {
		Text string `json:"text"`
	}
	_ = json.Unmarshal([]byte(text), &content)
	if content.Text != "" {
		text = content.Text
	}
	msgID := envelope.Event.Message.MessageID
	if msgID == "" {
		msgID = envelope.Header.EventID
	}
	return &InboundEvent{
		ExternalMessageID: msgID,
		ExternalThreadID:  envelope.Event.Message.ChatID,
		ExternalUserID:    envelope.Event.Sender.SenderID.OpenID,
		SenderName:        envelope.Event.Sender.SenderID.OpenID,
		Text:              strings.TrimSpace(text),
	}, nil
}

func (p *FeishuProvider) tenantToken(ctx context.Context, cfg feishuBridgeConfig) (string, error) {
	cacheKey := "feishu:" + cfg.AppID
	if token, ok := p.tokens.get(cacheKey); ok {
		return token, nil
	}
	var out struct {
		Code              int    `json:"code"`
		TenantAccessToken string `json:"tenant_access_token"`
		Expire            int    `json:"expire"`
	}
	err := doJSONRequest(ctx, p.client(), http.MethodPost,
		"https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
		nil, map[string]string{"app_id": cfg.AppID, "app_secret": cfg.AppSecret}, &out)
	if err != nil {
		return "", err
	}
	if out.Code != 0 || out.TenantAccessToken == "" {
		return "", fmt.Errorf("feishu auth failed code=%d", out.Code)
	}
	p.tokens.set(cacheKey, out.TenantAccessToken, time.Duration(out.Expire)*time.Second)
	return out.TenantAccessToken, nil
}

func (p *FeishuProvider) client() *http.Client { return (&httpJSON{HTTP: p.HTTP}).client() }
