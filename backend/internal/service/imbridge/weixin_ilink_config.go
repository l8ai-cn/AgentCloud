package imbridge

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// iLink API constants aligned with OpenClaw @tencent-weixin/openclaw-weixin.
const (
	defaultIlinkBaseURL   = "https://ilinkai.weixin.qq.com"
	ilinkAppID            = "bot"
	ilinkAppClientVersion = (2 << 16) | (2 << 8)
	ilinkAuthType         = "ilink_bot_token"
	epGetBotQR            = "ilink/bot/get_bot_qrcode"
	epGetQRStatus         = "ilink/bot/get_qrcode_status"
	epGetUpdates          = "ilink/bot/getupdates"
	epSendMessage         = "ilink/bot/sendmessage"
	ilinkDefaultBotAgent  = "AgentCloud/1.0"
	ilinkPollTimeout      = 35 * time.Second
)

type weixinBridgeConfig struct {
	AccountID     string `json:"account_id"`
	BotToken      string `json:"bot_token"`
	BaseURL       string `json:"base_url,omitempty"`
	UserID        string `json:"user_id,omitempty"`
	BotAgent      string `json:"bot_agent,omitempty"`
	GetUpdatesBuf string `json:"get_updates_buf,omitempty"`
}

func parseWeixinConfig(raw json.RawMessage) (weixinBridgeConfig, error) {
	var cfg weixinBridgeConfig
	if len(raw) == 0 {
		return cfg, nil
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return cfg, err
	}
	if strings.TrimSpace(cfg.BaseURL) == "" {
		cfg.BaseURL = defaultIlinkBaseURL
	}
	return cfg, nil
}

func (cfg weixinBridgeConfig) baseURL() string {
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return defaultIlinkBaseURL
	}
	return strings.TrimRight(cfg.BaseURL, "/")
}

func weixinBaseInfo(cfg weixinBridgeConfig) map[string]string {
	agent := strings.TrimSpace(cfg.BotAgent)
	if agent == "" {
		agent = ilinkDefaultBotAgent
	}
	return map[string]string{
		"channel_version": fmt.Sprintf("%d", ilinkAppClientVersion),
		"bot_agent":       agent,
	}
}
