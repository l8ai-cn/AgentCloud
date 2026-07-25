package imbridge

import (
	"context"
	"fmt"

	channelDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/channel"
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	channelSvc "github.com/l8ai-cn/agentcloud/backend/internal/service/channel"
)

func (b *Bridge) resolveChannel(ctx context.Context, conn *domain.Connection, threadID, contextToken string) (int64, error) {
	if mapping, err := b.repo.GetThreadMapping(ctx, conn.ID, threadID); err != nil {
		return 0, err
	} else if mapping != nil {
		if contextToken != "" && (mapping.ContextToken == nil || *mapping.ContextToken != contextToken) {
			mapping.ContextToken = strPtrIf(contextToken)
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
		PeerKind:         domain.PeerGroup,
	}); err != nil {
		return 0, err
	}
	return ch.ID, nil
}
