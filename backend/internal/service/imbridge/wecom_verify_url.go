package imbridge

import (
	"context"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (b *Bridge) VerifyWeComURL(ctx context.Context, connectionID int64, token, timestamp, nonce, echostr, signature string) (string, error) {
	conn, err := b.connectionForWebhook(ctx, domain.ProviderWeCom, token, connectionID)
	if err != nil {
		return "", err
	}
	p, err := GetProvider(b.registry, domain.ProviderWeCom)
	if err != nil {
		return "", err
	}
	wp, ok := p.(*WeComProvider)
	if !ok {
		return "", ErrInvalidProvider
	}
	cfg, err := b.providerConfig(conn)
	if err != nil {
		return "", err
	}
	return wp.VerifyURL(cfg, timestamp, nonce, echostr, signature)
}
