package imbridge

import (
	"context"
	"encoding/json"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func inferPeerKind(event *InboundEvent) string {
	// Providers that only support DM (weixin) always direct.
	if event == nil {
		return domain.PeerGroup
	}
	thread := strings.TrimSpace(event.ExternalThreadID)
	user := strings.TrimSpace(event.ExternalUserID)
	if user != "" && (thread == "" || thread == user) {
		return domain.PeerDirect
	}
	return domain.PeerGroup
}

func allowFromMatches(raw json.RawMessage, externalUserID, senderName string) bool {
	var items []string
	if err := json.Unmarshal(raw, &items); err != nil || len(items) == 0 {
		return false
	}
	extID := strings.TrimSpace(externalUserID)
	name := strings.TrimSpace(senderName)
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "*" {
			return true
		}
		if item == extID || item == name {
			return true
		}
		if strings.HasPrefix(item, "user:") && strings.TrimPrefix(item, "user:") == name {
			return true
		}
	}
	return false
}

func (b *Bridge) checkGroupPolicy(ctx context.Context, conn *domain.Connection, event *InboundEvent) error {
	peer := inferPeerKind(event)
	if peer == domain.PeerDirect {
		return nil
	}
	switch conn.GroupPolicy {
	case domain.GroupPolicyDisabled:
		return ErrUnauthorized
	case domain.GroupPolicyOpen:
		return nil
	default: // allowlist
		if allowFromMatches(conn.AllowFrom, event.ExternalUserID, event.SenderName) ||
			allowFromMatches(conn.AllowFrom, event.ExternalThreadID, "") {
			return nil
		}
		// An operator-configured destination is itself an allow decision: a
		// connection pinned to one channel, or a group already mapped while a
		// looser policy was in effect.
		if conn.ChannelID != nil {
			return nil
		}
		if mapping, err := b.repo.GetThreadMapping(ctx, conn.ID, event.ExternalThreadID); err == nil && mapping != nil {
			return nil
		}
		return ErrUnauthorized
	}
}
