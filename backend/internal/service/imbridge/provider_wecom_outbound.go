package imbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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
