package imbridge

import (
	"context"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type PodCatalog interface {
	ListOnlinePodKeys(ctx context.Context, orgID int64) ([]string, error)
}

type PromptRouter interface {
	RoutePrompt(podKey string, prompt string) error
}

func (b *Bridge) handleCommand(ctx context.Context, conn *domain.Connection, event *InboundEvent, mapping *domain.ThreadMapping) (handled bool, reply string, err error) {
	text := strings.TrimSpace(event.Text)
	if !strings.HasPrefix(text, "/") {
		return false, "", nil
	}
	fields := strings.Fields(text)
	cmd := strings.ToLower(fields[0])
	arg := ""
	if len(fields) > 1 {
		arg = strings.TrimSpace(strings.TrimPrefix(text, fields[0]))
	}
	switch cmd {
	case "/help":
		return true, botText(conn, "command_help"), nil
	case "/workers":
		return b.replyOnlineWorkers(ctx, conn)
	case "/use":
		if arg == "" || mapping == nil {
			return true, botText(conn, "use_usage"), nil
		}
		mapping.ActiveTargetRef = &arg
		if err := b.repo.UpsertThreadMapping(ctx, mapping); err != nil {
			return true, "", err
		}
		return true, botText(conn, "use_switched", arg), nil
	case "/new":
		if mapping == nil {
			return true, botText(conn, "new_nothing"), nil
		}
		mapping.ActiveTargetRef = nil
		if err := b.repo.UpsertThreadMapping(ctx, mapping); err != nil {
			return true, "", err
		}
		return true, botText(conn, "new_reset"), nil
	case "/status":
		target := botText(conn, "status_unbound")
		if mapping != nil && mapping.ActiveTargetRef != nil {
			target = *mapping.ActiveTargetRef
		}
		return true, botText(conn, "status_line", conn.Name, conn.Status, target), nil
	case "/stop":
		if b.prompts == nil || mapping == nil || mapping.ActiveTargetRef == nil {
			return true, botText(conn, "stop_nothing"), nil
		}
		_ = b.prompts.RoutePrompt(*mapping.ActiveTargetRef, stopPrompt)
		return true, botText(conn, "stop_sent"), nil
	case "/pair":
		return true, botText(conn, "command_pair_hint"), nil
	default:
		return false, "", nil
	}
}

func (b *Bridge) replyOnlineWorkers(ctx context.Context, conn *domain.Connection) (bool, string, error) {
	if b.pods == nil {
		return true, botText(conn, "workers_unavailable"), nil
	}
	keys, err := b.pods.ListOnlinePodKeys(ctx, conn.OrganizationID)
	if err != nil {
		return true, "", err
	}
	if len(keys) == 0 {
		return true, botText(conn, "workers_none"), nil
	}
	return true, botText(conn, "workers_online", strings.Join(keys, "\n- ")), nil
}
