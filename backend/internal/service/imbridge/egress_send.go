package imbridge

import (
	"context"
	"encoding/json"
	"time"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func withRetry(fn func() error) error {
	var last error
	for attempt := 0; attempt < 3; attempt++ {
		if err := fn(); err == nil {
			return nil
		} else {
			last = err
		}
		time.Sleep(time.Duration(40<<attempt) * time.Millisecond)
	}
	return last
}

func (b *Bridge) sendChunks(
	ctx context.Context,
	conn *domain.Connection,
	threadID, contextToken, text, replaceID string,
) (lastMessageID string, err error) {
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
			ExternalThreadID: threadID,
			Text:             chunk,
			SenderLabel:      "Agent Cloud",
			ContextToken:     contextToken,
		}
		if i == 0 && replaceID != "" {
			msg.ReplaceMessageID = replaceID
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
	err := withRetry(func() error {
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
