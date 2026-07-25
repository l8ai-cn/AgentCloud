package imbridge

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// iLink API constants aligned with OpenClaw @tencent-weixin/openclaw-weixin and doagent wechat.rs.
const (
	defaultIlinkBaseURL      = "https://ilinkai.weixin.qq.com"
	ilinkAppID               = "bot"
	ilinkAppClientVersion    = (2 << 16) | (2 << 8)
	ilinkAuthType            = "ilink_bot_token"
	epGetBotQR               = "ilink/bot/get_bot_qrcode"
	epGetQRStatus            = "ilink/bot/get_qrcode_status"
	epGetUpdates             = "ilink/bot/getupdates"
	epSendMessage            = "ilink/bot/sendmessage"
	ilinkDefaultBotAgent     = "AgentCloud/1.0"
	ilinkPollTimeout         = 35 * time.Second
)

type weixinBridgeConfig struct {
	AccountID      string `json:"account_id"`
	BotToken       string `json:"bot_token"`
	BaseURL        string `json:"base_url,omitempty"`
	UserID         string `json:"user_id,omitempty"`
	BotAgent       string `json:"bot_agent,omitempty"`
	GetUpdatesBuf  string `json:"get_updates_buf,omitempty"`
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

type ilinkClient struct {
	http *http.Client
}

func newIlinkClient(httpClient *http.Client) *ilinkClient {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &ilinkClient{http: httpClient}
}

func randomWechatUIN() string {
	var buf [4]byte
	_, _ = rand.Read(buf[:])
	n := uint32(buf[0])<<24 | uint32(buf[1])<<16 | uint32(buf[2])<<8 | uint32(buf[3])
	return base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%d", n)))
}

func (c *ilinkClient) headers(bodyLen *int, token string) http.Header {
	h := make(http.Header)
	h.Set("iLink-App-Id", ilinkAppID)
	h.Set("iLink-App-ClientVersion", fmt.Sprintf("%d", ilinkAppClientVersion))
	h.Set("X-WECHAT-UIN", randomWechatUIN())
	if bodyLen != nil {
		h.Set("Content-Type", "application/json")
	}
	if token != "" {
		h.Set("AuthorizationType", ilinkAuthType)
		h.Set("Authorization", "Bearer "+token)
	}
	return h
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

func (c *ilinkClient) getJSON(ctx context.Context, baseURL, endpoint string) (map[string]any, error) {
	url := baseURL + "/" + strings.TrimPrefix(endpoint, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header = c.headers(nil, "")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ilink GET %s: HTTP %d: %s", endpoint, resp.StatusCode, string(body))
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *ilinkClient) postJSON(ctx context.Context, baseURL, endpoint, token string, payload any) (map[string]any, error) {
	url := baseURL + "/" + strings.TrimPrefix(endpoint, "/")
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	n := len(b)
	req.Header = c.headers(&n, token)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ilink POST %s: HTTP %d: %s", endpoint, resp.StatusCode, string(body))
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out, nil
}

type weixinQRResult struct {
	QRCodeValue string
	QRCodeURL   string
}

func (c *ilinkClient) fetchBotQR(ctx context.Context, botType string) (*weixinQRResult, error) {
	endpoint := fmt.Sprintf("%s?bot_type=%s", epGetBotQR, botType)
	payload, err := c.getJSON(ctx, defaultIlinkBaseURL, endpoint)
	if err != nil {
		return nil, err
	}
	value, _ := payload["qrcode"].(string)
	url, _ := payload["qrcode_img_content"].(string)
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, fmt.Errorf("ilink QR response missing qrcode")
	}
	return &weixinQRResult{QRCodeValue: value, QRCodeURL: normalizeQRImageSrc(url)}, nil
}

func (c *ilinkClient) pollQRStatus(ctx context.Context, baseURL, qrcodeValue string) (map[string]any, error) {
	endpoint := fmt.Sprintf("%s?qrcode=%s", epGetQRStatus, qrcodeValue)
	return c.getJSON(ctx, baseURL, endpoint)
}

func normalizeQRImageSrc(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "data:image/") || strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw
	}
	return "data:image/png;base64," + raw
}
