package imbridge

import (
	"context"
	"net/http"
	"strings"
	"time"

	channelDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/channel"
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	channelSvc "github.com/l8ai-cn/agentcloud/backend/internal/service/channel"
)

type contextKey struct{}

var skipOutboundKey = contextKey{}

func WithSkipOutbound(ctx context.Context) context.Context {
	return context.WithValue(ctx, skipOutboundKey, true)
}

func skipOutbound(ctx context.Context) bool {
	v, _ := ctx.Value(skipOutboundKey).(bool)
	return v
}

type ChannelBridge interface {
	SendMessageAsUser(ctx context.Context, channelID, userID int64, content channelDomain.MessageContent) (*channelDomain.Message, error)
	GetChannel(ctx context.Context, channelID int64) (*channelDomain.Channel, error)
	CreateChannel(ctx context.Context, req *channelSvc.CreateChannelRequest) (*channelDomain.Channel, error)
}

type Bridge struct {
	*Service
	channels    ChannelBridge
	weixinLogin *weixinLoginStore
	dedupe      *inboundDedupe
	pods        PodCatalog
	prompts     PromptRouter
}

func NewBridge(svc *Service, channels ChannelBridge) *Bridge {
	return &Bridge{
		Service:     svc,
		channels:    channels,
		weixinLogin: newWeixinLoginStore(),
		dedupe:      newInboundDedupe(24 * time.Hour),
	}
}

func (b *Bridge) SetPodCatalog(pods PodCatalog)   { b.pods = pods }
func (b *Bridge) SetPromptRouter(r PromptRouter) { b.prompts = r }

func (b *Bridge) HandleWebhookDeliver(ctx context.Context, provider string, connectionID int64, token string, hdr http.Header, body []byte) (interface{}, error) {
	conn, err := b.connectionForWebhook(ctx, provider, token, connectionID)
	if err != nil {
		return nil, err
	}
	if conn.Status != domain.StatusActive {
		return nil, ErrConnectionPaused
	}
	p, err := GetProvider(b.registry, provider)
	if err != nil {
		return nil, err
	}
	cfg, err := b.providerConfig(conn)
	if err != nil {
		return nil, err
	}
	if err := p.VerifyWebhook(ctx, cfg, hdr, body); err != nil {
		b.markError(ctx, conn, err.Error())
		return nil, err
	}
	event, err := p.ParseInbound(ctx, cfg, hdr, body)
	if err != nil {
		b.markError(ctx, conn, err.Error())
		return nil, err
	}
	if event == nil {
		return map[string]string{"status": "ignored"}, nil
	}
	if event.Challenge != "" {
		switch provider {
		case domain.ProviderFeishu, domain.ProviderSlack:
			return map[string]string{"challenge": event.Challenge}, nil
		default:
			return event.Challenge, nil
		}
	}
	if strings.TrimSpace(event.Text) == "" {
		return map[string]string{"status": "ignored"}, nil
	}
	if err := b.DeliverInbound(ctx, conn, event); err != nil {
		if err == ErrUnauthorized || err == ErrPairingRequired {
			return map[string]string{"status": "rejected"}, nil
		}
		b.markError(ctx, conn, err.Error())
		return nil, err
	}
	now := time.Now().UTC()
	conn.LastSeenAt = &now
	_ = b.repo.UpdateConnection(ctx, conn)
	return map[string]string{"status": "delivered"}, nil
}
