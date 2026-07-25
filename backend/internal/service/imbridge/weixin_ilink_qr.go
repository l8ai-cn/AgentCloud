package imbridge

import (
	"context"
	"fmt"
	"strings"
)

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
