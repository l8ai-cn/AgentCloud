package imbridge

import (
	"context"
	"fmt"
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
		return true, "可用指令：/help /workers /use <pod> /status /new /stop /pair", nil
	case "/workers":
		if b.pods == nil {
			return true, "worker 目录不可用", nil
		}
		keys, err := b.pods.ListOnlinePodKeys(ctx, conn.OrganizationID)
		if err != nil {
			return true, "", err
		}
		if len(keys) == 0 {
			return true, "当前组织没有在线 worker", nil
		}
		return true, "在线 worker：\n- " + strings.Join(keys, "\n- "), nil
	case "/use":
		if arg == "" || mapping == nil {
			return true, "用法：/use <pod-key>", nil
		}
		mapping.ActiveTargetRef = &arg
		if err := b.repo.UpsertThreadMapping(ctx, mapping); err != nil {
			return true, "", err
		}
		return true, fmt.Sprintf("已切换本会话 worker 为 %s", arg), nil
	case "/new":
		if mapping == nil {
			return true, "无可重置会话", nil
		}
		mapping.ActiveTargetRef = nil
		if err := b.repo.UpsertThreadMapping(ctx, mapping); err != nil {
			return true, "", err
		}
		return true, "已重置会话 worker 选择", nil
	case "/status":
		target := "(未绑定)"
		if mapping != nil && mapping.ActiveTargetRef != nil {
			target = *mapping.ActiveTargetRef
		}
		return true, fmt.Sprintf("连接=%s 状态=%s 会话worker=%s", conn.Name, conn.Status, target), nil
	case "/stop":
		if b.prompts == nil || mapping == nil || mapping.ActiveTargetRef == nil {
			return true, "没有可停止的 worker", nil
		}
		_ = b.prompts.RoutePrompt(*mapping.ActiveTargetRef, "User requested stop via IM /stop. Please stop current work.")
		return true, "已向 worker 发送停止请求", nil
	case "/pair":
		return true, "请向机器人发送任意消息以获取配对码，然后在网页个人设置中输入。", nil
	default:
		return false, "", nil
	}
}
