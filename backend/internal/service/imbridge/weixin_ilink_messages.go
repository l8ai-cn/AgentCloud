package imbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type weixinUpdatesResult struct {
	Messages      []map[string]any
	GetUpdatesBuf string
	LongPollMS    int
	Ret           int
	ErrCode       int
	ErrMsg        string
}

func (c *ilinkClient) getUpdates(ctx context.Context, cfg weixinBridgeConfig) (*weixinUpdatesResult, error) {
	ctx, cancel := context.WithTimeout(ctx, ilinkPollTimeout+5*time.Second)
	defer cancel()
	payload, err := c.postJSON(ctx, cfg.baseURL(), epGetUpdates, cfg.BotToken, map[string]any{
		"get_updates_buf": cfg.GetUpdatesBuf,
		"base_info":       weixinBaseInfo(cfg),
	})
	if err != nil {
		return nil, err
	}
	out := &weixinUpdatesResult{}
	if v, ok := payload["ret"].(float64); ok {
		out.Ret = int(v)
	}
	if v, ok := payload["errcode"].(float64); ok {
		out.ErrCode = int(v)
	}
	if v, ok := payload["errmsg"].(string); ok {
		out.ErrMsg = v
	}
	if v, ok := payload["get_updates_buf"].(string); ok {
		out.GetUpdatesBuf = v
	}
	if v, ok := payload["longpolling_timeout_ms"].(float64); ok {
		out.LongPollMS = int(v)
	}
	if raw, ok := payload["msgs"].([]any); ok {
		for _, item := range raw {
			if m, ok := item.(map[string]any); ok {
				out.Messages = append(out.Messages, m)
			}
		}
	}
	return out, nil
}

func (c *ilinkClient) sendText(ctx context.Context, cfg weixinBridgeConfig, toUserID, contextToken, text string) error {
	_, err := c.postJSON(ctx, cfg.baseURL(), epSendMessage, cfg.BotToken, map[string]any{
		"msg": map[string]any{
			"to_user_id":    toUserID,
			"context_token": contextToken,
			"item_list": []map[string]any{
				{
					"type":      1,
					"text_item": map[string]string{"text": text},
				},
			},
		},
	})
	return err
}

func parseWeixinInbound(msg map[string]any) *InboundEvent {
	msgType, _ := msg["message_type"].(float64)
	if int(msgType) == 2 {
		return nil
	}
	fromUser, _ := msg["from_user_id"].(string)
	fromUser = strings.TrimSpace(fromUser)
	contextToken, _ := msg["context_token"].(string)
	msgID, _ := msg["message_id"].(string)
	if msgID == "" {
		if n, ok := msg["message_id"].(float64); ok {
			msgID = fmt.Sprintf("%.0f", n)
		}
	}
	text := extractWeixinText(msg)
	if strings.TrimSpace(text) == "" || fromUser == "" {
		return nil
	}
	return &InboundEvent{
		ExternalMessageID: msgID,
		ExternalThreadID:  fromUser,
		ExternalUserID:    fromUser,
		SenderName:        fromUser,
		Text:              strings.TrimSpace(text),
		ContextToken:      contextToken,
	}
}

func extractWeixinText(msg map[string]any) string {
	items, ok := msg["item_list"].([]any)
	if !ok {
		return ""
	}
	var parts []string
	for _, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		t, _ := item["type"].(float64)
		if int(t) != 1 {
			continue
		}
		if textItem, ok := item["text_item"].(map[string]any); ok {
			if text, ok := textItem["text"].(string); ok && strings.TrimSpace(text) != "" {
				parts = append(parts, text)
			}
		}
	}
	return strings.Join(parts, "\n")
}

func mergeWeixinConfig(raw json.RawMessage, patch weixinBridgeConfig) (json.RawMessage, error) {
	cfg, err := parseWeixinConfig(raw)
	if err != nil {
		return nil, err
	}
	if patch.AccountID != "" {
		cfg.AccountID = patch.AccountID
	}
	if patch.BotToken != "" {
		cfg.BotToken = patch.BotToken
	}
	if patch.BaseURL != "" {
		cfg.BaseURL = patch.BaseURL
	}
	if patch.UserID != "" {
		cfg.UserID = patch.UserID
	}
	if patch.BotAgent != "" {
		cfg.BotAgent = patch.BotAgent
	}
	cfg.GetUpdatesBuf = patch.GetUpdatesBuf
	return json.Marshal(cfg)
}
