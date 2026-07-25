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
	if err := b.checkGroupPolicy(conn, event); err != nil {
		return err
	}
	identity, err := b.resolveIdentity(ctx, conn, event)
	if err != nil {
		return err
	}
	channelID, err := b.resolveChannel(ctx, conn, event.ExternalThreadID, event.ContextToken)
	if err != nil {
		return err
	}
	mapping, _ := b.repo.GetThreadMapping(ctx, conn.ID, event.ExternalThreadID)
	if mapping != nil {
		mapping.PeerKind = inferPeerKind(event)
	}
	if identity.Pending && identity.Code != "" {
		_ = b.replyText(ctx, conn, event, pairingPrompt(identity.Code))
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
	_, err = b.channels.SendMessageAsUser(WithSkipOutbound(ctx), channelID, identity.UserID, content)
	return err
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
	p, err := GetProvider(b.registry, conn.Provider)
	if err != nil {
		return err
	}
	cfg, err := b.providerConfig(conn)
	if err != nil {
		return err
	}
	for _, chunk := range chunkText(text, 3500) {
		if err := p.SendOutbound(ctx, cfg, OutboundMessage{
			ExternalThreadID: event.ExternalThreadID,
			Text:             chunk,
			ContextToken:     event.ContextToken,
		}); err != nil {
			return err
		}
	}
	return nil
}

func strPtr(s string) *string { return &s }

func strPtrIf(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func sanitizeName(s string) string {
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return '-'
	}, s)
	if len(s) > 40 {
		s = s[:40]
	}
	return strings.Trim(s, "-")
}
