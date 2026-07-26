package imbridge

import (
	"context"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (b *Bridge) DeliverInbound(ctx context.Context, conn *domain.Connection, event *InboundEvent) error {
	if conn.Status != domain.StatusActive || strings.TrimSpace(event.Text) == "" {
		return nil
	}
	if !b.claimMessage(ctx, conn.ID, event.ExternalMessageID) {
		return nil
	}
	if err := b.checkGroupPolicy(ctx, conn, event); err != nil {
		return err
	}
	identity, err := b.resolveIdentity(ctx, conn, event)
	if err != nil {
		return err
	}
	channelID, err := b.resolveChannel(ctx, conn, event)
	if err != nil {
		return err
	}
	mapping, _ := b.repo.GetThreadMapping(ctx, conn.ID, event.ExternalThreadID)
	if identity.Pending && identity.Code != "" {
		_ = b.replyText(ctx, conn, event, pairingPrompt(conn, identity.Code))
		return ErrPairingRequired
	}
	if handled, reply, err := b.handleCommand(ctx, conn, event, mapping); handled {
		if err != nil {
			return err
		}
		return b.replyText(ctx, conn, event, reply)
	}
	route, err := b.resolveRoute(ctx, conn, event, mapping)
	if err != nil {
		return err
	}
	text := applyRouteMention(event.Text, route)
	label := event.SenderName
	if label == "" {
		label = event.ExternalUserID
	}
	if label == "" {
		label = conn.Provider
	}
	content := composeInboundContent(label, text)
	if _, err = b.channels.SendMessageAsUser(WithSkipOutbound(ctx), channelID, identity.UserID, content); err != nil {
		return err
	}
	if mapping == nil {
		mapping, _ = b.repo.GetThreadMapping(ctx, conn.ID, event.ExternalThreadID)
	}
	b.startProgressDraft(ctx, conn, event, mapping, route)
	return nil
}

func (b *Bridge) claimMessage(ctx context.Context, connectionID int64, externalMessageID string) bool {
	if !b.dedupe.Claim(ctx, connectionID, externalMessageID) {
		return false
	}
	ok, err := b.repo.ClaimInboundMessage(ctx, connectionID, externalMessageID)
	if err != nil {
		return true // fail-open to memory claim
	}
	return ok
}

func (b *Bridge) replyText(ctx context.Context, conn *domain.Connection, event *InboundEvent, text string) error {
	_, err := b.sendChunks(ctx, conn, eventTarget(event), text)
	return err
}

func eventTarget(event *InboundEvent) egressTarget {
	return egressTarget{
		ThreadID:     event.ExternalThreadID,
		PeerKind:     inferPeerKind(event),
		ContextToken: event.ContextToken,
	}
}
