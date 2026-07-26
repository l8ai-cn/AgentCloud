package imbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (p *WeComProvider) SendOutbound(ctx context.Context, raw json.RawMessage, msg OutboundMessage) error {
	var cfg weComBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	token, err := p.accessToken(ctx, cfg)
	if err != nil {
		return err
	}
	endpoint, payload := wecomSendRequest(cfg, msg)
	return doJSONRequest(ctx, p.client(), http.MethodPost,
		endpoint+"?access_token="+url.QueryEscape(token), nil, payload, nil)
}

// wecomSendRequest picks the addressing scheme: ParseInbound reports a group as
// its ChatId, which `message/send` would misread as a user id.
func wecomSendRequest(cfg weComBridgeConfig, msg OutboundMessage) (string, map[string]any) {
	text := map[string]string{"content": msg.Text}
	if msg.PeerKind == domain.PeerGroup {
		return "https://qyapi.weixin.qq.com/cgi-bin/appchat/send", map[string]any{
			"chatid":  msg.ExternalThreadID,
			"msgtype": "text",
			"text":    text,
		}
	}
	return "https://qyapi.weixin.qq.com/cgi-bin/message/send", map[string]any{
		"touser":  msg.ExternalThreadID,
		"msgtype": "text",
		"agentid": cfg.AgentID,
		"text":    text,
	}
}

func (p *WeComProvider) accessToken(ctx context.Context, cfg weComBridgeConfig) (string, error) {
	cacheKey := fmt.Sprintf("wecom:%s:%d", cfg.CorpID, cfg.AgentID)
	if token, ok := p.tokens.get(cacheKey); ok {
		return token, nil
	}
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
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
	p.tokens.set(cacheKey, out.AccessToken, time.Duration(out.ExpiresIn)*time.Second)
	return out.AccessToken, nil
}

func (p *WeComProvider) client() *http.Client { return (&httpJSON{HTTP: p.HTTP}).client() }
