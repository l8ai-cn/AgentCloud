package imbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

func (p *FeishuProvider) SendOutbound(ctx context.Context, raw json.RawMessage, msg OutboundMessage) error {
	_, err := p.SendOutboundTracked(ctx, raw, msg)
	return err
}

func (p *FeishuProvider) SendOutboundTracked(ctx context.Context, raw json.RawMessage, msg OutboundMessage) (string, error) {
	var cfg feishuBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return "", err
	}
	token, err := p.tenantToken(ctx, cfg)
	if err != nil {
		return "", err
	}
	chatID := msg.ExternalThreadID
	if chatID == "" {
		chatID = cfg.DefaultChatID
	}
	content, _ := json.Marshal(map[string]string{"text": msg.Text})
	payload := map[string]any{
		"receive_id": chatID,
		"msg_type":   "text",
		"content":    string(content),
	}
	var out struct {
		Code int `json:"code"`
		Data struct {
			MessageID string `json:"message_id"`
		} `json:"data"`
		Msg string `json:"msg"`
	}
	err = doJSONRequest(ctx, p.client(), http.MethodPost,
		"https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id",
		map[string]string{"Authorization": "Bearer " + token}, payload, &out)
	if err != nil {
		return "", err
	}
	if out.Code != 0 {
		return "", fmt.Errorf("feishu send failed code=%d msg=%s", out.Code, out.Msg)
	}
	return out.Data.MessageID, nil
}

func (p *FeishuProvider) UpdateOutbound(ctx context.Context, raw json.RawMessage, msg OutboundMessage) error {
	if msg.ReplaceMessageID == "" {
		return fmt.Errorf("feishu update requires ReplaceMessageID")
	}
	var cfg feishuBridgeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	token, err := p.tenantToken(ctx, cfg)
	if err != nil {
		return err
	}
	content, _ := json.Marshal(map[string]string{"text": msg.Text})
	payload := map[string]any{
		"msg_type": "text",
		"content":  string(content),
	}
	var out struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}
	endpoint := "https://open.feishu.cn/open-apis/im/v1/messages/" + url.PathEscape(msg.ReplaceMessageID)
	err = doJSONRequest(ctx, p.client(), http.MethodPatch, endpoint,
		map[string]string{"Authorization": "Bearer " + token}, payload, &out)
	if err != nil {
		return err
	}
	if out.Code != 0 {
		return fmt.Errorf("feishu update failed code=%d msg=%s", out.Code, out.Msg)
	}
	return nil
}
