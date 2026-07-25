package imbridge

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (b *Bridge) refreshWeixinQR(ctx context.Context, orgID int64, sessionID string, snapshot *weixinQRSession, wp *WeixinProvider) (map[string]any, error) {
	if snapshot.RefreshCount >= maxWeixinQRRefreshes {
		b.weixinLogin.mu.Lock()
		delete(b.weixinLogin.sessions, sessionID)
		b.weixinLogin.mu.Unlock()
		return map[string]any{
			"session_id": sessionID,
			"status":     "failed",
			"message":    "二维码多次过期，请重新开始登录",
		}, nil
	}
	qr, err := wp.ilink().fetchBotQR(ctx, "3")
	if err != nil {
		return nil, err
	}
	b.weixinLogin.mu.Lock()
	if s, ok := b.weixinLogin.sessions[sessionID]; ok {
		s.QRCodeValue = qr.QRCodeValue
		s.QRCodeURL = qr.QRCodeURL
		s.BaseURL = defaultIlinkBaseURL
		s.RefreshCount++
	}
	b.weixinLogin.mu.Unlock()
	return map[string]any{
		"session_id": sessionID,
		"status":     "wait",
		"message":    "二维码已刷新，请重新扫码",
		"qrcode":     qr.QRCodeValue,
		"qrcode_url": qr.QRCodeURL,
		"expires_at": snapshot.DeadlineUnix,
		"refreshed":  true,
	}, nil
}

func (b *Bridge) completeWeixinQRLogin(ctx context.Context, orgID int64, sessionID string, snapshot *weixinQRSession, payload map[string]any) (map[string]any, error) {
	accountID, _ := payload["ilink_bot_id"].(string)
	token, _ := payload["bot_token"].(string)
	baseURL, _ := payload["baseurl"].(string)
	userID, _ := payload["ilink_user_id"].(string)
	accountID = strings.TrimSpace(accountID)
	token = strings.TrimSpace(token)
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		baseURL = defaultIlinkBaseURL
	}
	if accountID == "" || token == "" {
		return nil, fmt.Errorf("ilink confirmed login but credential payload was incomplete")
	}
	conn, err := b.GetConnection(ctx, orgID, snapshot.ConnectionID)
	if err != nil {
		return nil, err
	}
	if err := b.persistWeixinConfig(ctx, conn, weixinBridgeConfig{
		AccountID: accountID,
		BotToken:  token,
		BaseURL:   baseURL,
		UserID:    userID,
	}); err != nil {
		return nil, err
	}
	b.weixinLogin.mu.Lock()
	delete(b.weixinLogin.sessions, sessionID)
	b.weixinLogin.mu.Unlock()
	slog.InfoContext(ctx, "weixin ilink login confirmed", "connection_id", conn.ID, "account_id", accountID)
	return map[string]any{
		"session_id":    sessionID,
		"status":        "confirmed",
		"connection_id": conn.ID,
		"account_id":    accountID,
	}, nil
}

func (b *Bridge) GetWeixinQRImage(sessionID string) (mediaType string, data []byte, err error) {
	b.weixinLogin.mu.Lock()
	session, ok := b.weixinLogin.sessions[sessionID]
	b.weixinLogin.mu.Unlock()
	if !ok {
		return "", nil, ErrNotFound
	}
	src := strings.TrimSpace(session.QRCodeURL)
	if src == "" {
		return "", nil, fmt.Errorf("qr image unavailable")
	}
	if strings.HasPrefix(src, "data:image/") {
		parts := strings.SplitN(src, ",", 2)
		if len(parts) != 2 {
			return "", nil, fmt.Errorf("invalid data url")
		}
		header := strings.TrimPrefix(parts[0], "data:")
		mediaType = strings.TrimSuffix(header, ";base64")
		data, err = decodeBase64(parts[1])
		return mediaType, data, err
	}
	return "", nil, fmt.Errorf("remote qr image fetch not implemented")
}

func decodeBase64(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}
