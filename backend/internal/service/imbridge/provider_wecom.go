package imbridge

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type WeComProvider struct{ HTTP *http.Client }

func (p *WeComProvider) Type() string        { return domain.ProviderWeCom }
func (p *WeComProvider) DisplayName() string { return "企业微信" }

type weComBridgeConfig struct {
	CorpID         string `json:"corp_id"`
	CorpSecret     string `json:"corp_secret"`
	Token          string `json:"token"`
	EncodingAESKey string `json:"encoding_aes_key,omitempty"`
	AgentID        int64  `json:"agent_id"`
}

type weComPlainMessage struct {
	XMLName      xml.Name `xml:"xml"`
	MsgType      string   `xml:"MsgType"`
	Content      string   `xml:"Content"`
	FromUserName string   `xml:"FromUserName"`
	ChatID       string   `xml:"ChatId"`
	MsgID        string   `xml:"MsgId"`
}

func (p *WeComProvider) ValidateConfig(raw json.RawMessage) error {
	var cfg weComBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.CorpID == "" || cfg.CorpSecret == "" || cfg.Token == "" || cfg.AgentID == 0 {
		return errors.New("wecom requires corp_id, corp_secret, token, agent_id")
	}
	if cfg.EncodingAESKey != "" && len(cfg.EncodingAESKey) != 43 {
		return errors.New("wecom encoding_aes_key must be 43 chars")
	}
	return nil
}

func (p *WeComProvider) VerifyWebhook(_ context.Context, raw json.RawMessage, headers http.Header, body []byte) error {
	var cfg weComBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.EncodingAESKey == "" {
		return errors.New("wecom requires encoding_aes_key for callback verification")
	}
	ts, nonce, sig := wecomSigParams(headers)
	if ts == "" || nonce == "" || sig == "" {
		return errors.New("wecom missing signature query headers")
	}
	encrypt, err := parseWeComXMLEncrypt(body)
	if err != nil {
		return err
	}
	if err := verifyWeComSignature(cfg.Token, ts, nonce, encrypt, sig); err != nil {
		return err
	}
	plain, receiveID, err := decryptWeComEncrypt(cfg.EncodingAESKey, encrypt)
	if err != nil {
		return err
	}
	if receiveID != "" && receiveID != cfg.CorpID {
		return fmt.Errorf("wecom receive id mismatch")
	}
	_ = plain
	return nil
}

// VerifyURL handles GET echostr URL verification for Agent mode callbacks.
func (p *WeComProvider) VerifyURL(cfgRaw json.RawMessage, timestamp, nonce, echostr, signature string) (string, error) {
	var cfg weComBridgeConfig
	if err := json.Unmarshal(cfgRaw, &cfg); err != nil {
		return "", err
	}
	if cfg.EncodingAESKey == "" {
		return "", errors.New("wecom requires encoding_aes_key")
	}
	if err := verifyWeComSignature(cfg.Token, timestamp, nonce, echostr, signature); err != nil {
		return "", err
	}
	plain, _, err := decryptWeComEncrypt(cfg.EncodingAESKey, echostr)
	return plain, err
}

func (p *WeComProvider) ParseInbound(_ context.Context, raw json.RawMessage, headers http.Header, body []byte) (*InboundEvent, error) {
	var cfg weComBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, err
	}
	if cfg.EncodingAESKey == "" {
		return nil, errors.New("wecom requires encoding_aes_key")
	}
	encrypt, err := parseWeComXMLEncrypt(body)
	if err != nil {
		return nil, err
	}
	plain, _, err := decryptWeComEncrypt(cfg.EncodingAESKey, encrypt)
	if err != nil {
		return nil, err
	}
	var msg weComPlainMessage
	if err := xml.Unmarshal([]byte(plain), &msg); err != nil {
		return nil, err
	}
	if !strings.EqualFold(msg.MsgType, "text") {
		return &InboundEvent{}, nil
	}
	thread := msg.ChatID
	if thread == "" {
		thread = msg.FromUserName
	}
	return &InboundEvent{
		ExternalMessageID: msg.MsgID,
		ExternalThreadID:  thread,
		ExternalUserID:    msg.FromUserName,
		SenderName:        msg.FromUserName,
		Text:              strings.TrimSpace(msg.Content),
	}, nil
}

func (p *WeComProvider) SendOutbound(ctx context.Context, raw json.RawMessage, msg OutboundMessage) error {
	var cfg weComBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	token, err := p.accessToken(ctx, cfg)
	if err != nil {
		return err
	}
	u := fmt.Sprintf("https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=%s", url.QueryEscape(token))
	return doJSONRequest(ctx, p.client(), http.MethodPost, u, nil, map[string]any{
		"touser":  msg.ExternalThreadID,
		"msgtype": "text",
		"agentid": cfg.AgentID,
		"text":    map[string]string{"content": msg.Text},
	}, nil)
}

func (p *WeComProvider) accessToken(ctx context.Context, cfg weComBridgeConfig) (string, error) {
	var out struct {
		AccessToken string `json:"access_token"`
		ErrCode     int    `json:"errcode"`
	}
	u := fmt.Sprintf("https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=%s&corpsecret=%s",
		url.QueryEscape(cfg.CorpID), url.QueryEscape(cfg.CorpSecret))
	if err := doJSONRequest(ctx, p.client(), http.MethodGet, u, nil, nil, &out); err != nil {
		return "", err
	}
	if out.ErrCode != 0 || out.AccessToken == "" {
		return "", fmt.Errorf("wecom token errcode=%d", out.ErrCode)
	}
	return out.AccessToken, nil
}

func (p *WeComProvider) client() *http.Client { return (&httpJSON{HTTP: p.HTTP}).client() }

func wecomSigParams(headers http.Header) (timestamp, nonce, signature string) {
	timestamp = headers.Get("X-Wecom-Timestamp")
	nonce = headers.Get("X-Wecom-Nonce")
	signature = headers.Get("X-Wecom-Signature")
	if timestamp == "" {
		timestamp = headers.Get("timestamp")
	}
	if nonce == "" {
		nonce = headers.Get("nonce")
	}
	if signature == "" {
		signature = headers.Get("msg_signature")
	}
	if signature == "" {
		signature = headers.Get("signature")
	}
	return timestamp, nonce, signature
}
