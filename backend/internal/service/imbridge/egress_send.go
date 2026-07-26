package imbridge

import (
	"context"
	"encoding/json"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

// egressTarget is where one outbound burst goes; ReplaceID set means the first
// chunk edits an existing progress draft instead of appending a message.
type egressTarget struct {
	ThreadID     string
	PeerKind     string
	ContextToken string
	ReplaceID    string
}

func (b *Bridge) sendChunks(ctx context.Context, conn *domain.Connection, target egressTarget, text string) (lastMessageID string, err error) {
	p, err := GetProvider(b.registry, conn.Provider)
	if err != nil {
		return "", err
	}
	cfg, err := b.providerConfig(conn)
	if err != nil {
		return "", err
	}
	tracker, _ := p.(OutboundTracker)
	for i, chunk := range chunkText(text, textLimitForProvider(conn.Provider)) {
		msg := OutboundMessage{
			ExternalThreadID: target.ThreadID,
			PeerKind:         target.PeerKind,
			Text:             chunk,
			SenderLabel:      senderLabel,
			ContextToken:     target.ContextToken,
		}
		if i == 0 && target.ReplaceID != "" {
			msg.ReplaceMessageID = target.ReplaceID
		}
		id, sendErr := sendOne(ctx, p, tracker, cfg, msg)
		if sendErr != nil {
			return lastMessageID, sendErr
		}
		if id != "" {
			lastMessageID = id
		}
	}
	return lastMessageID, nil
}

func sendOne(ctx context.Context, p Provider, tracker OutboundTracker, cfg json.RawMessage, msg OutboundMessage) (string, error) {
	var messageID string
	err := withRetry(ctx, func() error {
		if tracker != nil && msg.ReplaceMessageID != "" {
			if err := tracker.UpdateOutbound(ctx, cfg, msg); err == nil {
				messageID = msg.ReplaceMessageID
				return nil
			}
			msg.ReplaceMessageID = ""
		}
		if tracker != nil {
			id, err := tracker.SendOutboundTracked(ctx, cfg, msg)
			messageID = id
			return err
		}
		return p.SendOutbound(ctx, cfg, msg)
	})
	return messageID, err
}
