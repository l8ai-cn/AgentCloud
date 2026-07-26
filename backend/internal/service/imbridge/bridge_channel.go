package imbridge

import (
	"context"
	"fmt"

	channelDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/channel"
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	channelSvc "github.com/l8ai-cn/agentcloud/backend/internal/service/channel"
)

func (b *Bridge) resolveChannel(ctx context.Context, conn *domain.Connection, event *InboundEvent) (int64, error) {
	threadID := event.ExternalThreadID
	contextToken := event.ContextToken
	peerKind := inferPeerKind(event)
	if mapping, err := b.repo.GetThreadMapping(ctx, conn.ID, threadID); err != nil {
		return 0, err
	} else if mapping != nil {
		if refreshThreadMapping(mapping, contextToken, peerKind) {
			_ = b.repo.UpsertThreadMapping(ctx, mapping)
		}
		return mapping.ChannelID, nil
	}
	if conn.ChannelID != nil && *conn.ChannelID > 0 {
		return *conn.ChannelID, nil
	}
	name := fmt.Sprintf("im-%s-%s", conn.Provider, sanitizeName(threadID))
	ch, err := b.channels.CreateChannel(ctx, &channelSvc.CreateChannelRequest{
		OrganizationID:  conn.OrganizationID,
		Name:            name,
		Description:     strPtr(fmt.Sprintf("Auto-created IM bridge (%s)", conn.Provider)),
		CreatedByUserID: &conn.CreatedByUserID,
		Visibility:      channelDomain.VisibilityPrivate,
	})
	if err != nil {
		return 0, err
	}
	if err := b.repo.UpsertThreadMapping(ctx, &domain.ThreadMapping{
		ConnectionID:     conn.ID,
		ExternalThreadID: threadID,
		ChannelID:        ch.ID,
		ContextToken:     strPtrIf(contextToken),
		PeerKind:         peerKind,
	}); err != nil {
		return 0, err
	}
	return ch.ID, nil
}

// refreshThreadMapping keeps the persisted peer kind honest: outbound addressing
// (WeCom appchat vs message) reads it long after the inbound event is gone.
func refreshThreadMapping(mapping *domain.ThreadMapping, contextToken, peerKind string) bool {
	changed := false
	if contextToken != "" && (mapping.ContextToken == nil || *mapping.ContextToken != contextToken) {
		mapping.ContextToken = strPtrIf(contextToken)
		changed = true
	}
	if peerKind != "" && mapping.PeerKind != peerKind {
		mapping.PeerKind = peerKind
		changed = true
	}
	return changed
}
