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
				b.noteFailure(ctx, conn, err)
			}
		}
		return nil
	}
}

func (b *Bridge) deliverOutbound(ctx context.Context, conn *domain.Connection, channelID int64, body string) error {
	if conn.Status != domain.StatusActive {
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
	target := egressTarget{PeerKind: domain.PeerGroup}
	if mapping != nil {
		target.ThreadID = mapping.ExternalThreadID
		target.PeerKind = mapping.PeerKind
		if mapping.ContextToken != nil {
			target.ContextToken = *mapping.ContextToken
		}
		if mapping.DraftMessageID != nil {
			target.ReplaceID = *mapping.DraftMessageID
		}
	}
	if _, err := GetProvider(b.registry, conn.Provider); err != nil {
		return err
	}
	_, err = b.sendChunks(ctx, conn, target, body)
	if err == nil && mapping != nil && target.ReplaceID != "" {
		b.clearDraft(ctx, mapping)
	}
	return err
}
