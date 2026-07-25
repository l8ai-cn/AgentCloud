package imbridge

import (
	"context"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	channelSvc "github.com/l8ai-cn/agentcloud/backend/internal/service/channel"
)

func (b *Bridge) OutboundHook() channelSvc.PostSendHook {
	return func(ctx context.Context, mc *channelSvc.MessageContext) error {
		if skipOutbound(ctx) || mc == nil || mc.Channel == nil || mc.Message == nil {
			return nil
		}
		body := strings.TrimSpace(mc.Message.Body)
		if body == "" {
			return nil
		}
		conns, err := b.repo.ListConnections(ctx, mc.Channel.OrganizationID)
		if err != nil {
			return err
		}
		for _, conn := range conns {
			if err := b.deliverOutbound(ctx, conn, mc.Channel.ID, body); err != nil {
				b.markError(ctx, conn, err.Error())
			}
		}
		return nil
	}
}

func (b *Bridge) deliverOutbound(ctx context.Context, conn *domain.Connection, channelID int64, body string) error {
	if conn.Status != domain.StatusActive {
		return nil
	}
	if conn.OrganizationID == 0 {
		return nil
	}
	if conn.ChannelID != nil && *conn.ChannelID != channelID {
		return nil
	}
	mapping, err := b.repo.GetThreadMappingByChannel(ctx, conn.ID, channelID)
	if err != nil {
		return err
	}
	if conn.ChannelID == nil && mapping == nil {
		return nil
	}
	threadID := ""
	contextToken := ""
	if mapping != nil {
		threadID = mapping.ExternalThreadID
		if mapping.ContextToken != nil {
			contextToken = *mapping.ContextToken
		}
	}
	p, err := GetProvider(b.registry, conn.Provider)
	if err != nil {
		return nil
	}
	cfg, err := b.providerConfig(conn)
	if err != nil {
		return err
	}
	for _, chunk := range chunkText(body, textLimitForProvider(conn.Provider)) {
		if err := p.SendOutbound(ctx, cfg, OutboundMessage{
			ExternalThreadID: threadID,
			Text:             chunk,
			SenderLabel:      "Agent Cloud",
			ContextToken:     contextToken,
		}); err != nil {
			return err
		}
	}
	return nil
}

func textLimitForProvider(provider string) int {
	switch provider {
	case domain.ProviderDingTalk:
		return 3800
	case domain.ProviderFeishu:
		return 8000
	case domain.ProviderWeCom:
		return 2000
	default:
		return 3500
	}
}
