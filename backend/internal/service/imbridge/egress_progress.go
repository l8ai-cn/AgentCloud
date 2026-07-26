package imbridge

import (
	"context"
	"fmt"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func progressEnabled(conn *domain.Connection) bool {
	mode := strings.TrimSpace(conn.StreamingMode)
	return mode == "" || mode == "progress"
}

func progressText(route *routeResolution) string {
	if route == nil || route.TargetRef == "" {
		return "⏳ Working…"
	}
	return fmt.Sprintf("⏳ Working on @%s…", route.TargetRef)
}

func (b *Bridge) startProgressDraft(
	ctx context.Context,
	conn *domain.Connection,
	event *InboundEvent,
	mapping *domain.ThreadMapping,
	route *routeResolution,
) {
	if !progressEnabled(conn) || event == nil || mapping == nil {
		return
	}
	// Without a routed worker nothing will ever replace the draft, and an
	// existing draft already owns this thread's placeholder.
	if route == nil || route.TargetRef == "" || mapping.DraftMessageID != nil {
		return
	}
	msgID, err := b.sendChunks(ctx, conn, eventTarget(event), progressText(route))
	if err != nil || msgID == "" {
		return
	}
	mapping.DraftMessageID = &msgID
	_ = b.repo.UpsertThreadMapping(ctx, mapping)
}

func (b *Bridge) clearDraft(ctx context.Context, mapping *domain.ThreadMapping) {
	if mapping == nil {
		return
	}
	mapping.DraftMessageID = nil
	_ = b.repo.UpsertThreadMapping(ctx, mapping)
}
