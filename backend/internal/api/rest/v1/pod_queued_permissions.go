package v1

import (
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampauthz"
)

func (h *PodHandler) canCancelQueuedPod(tenant *middleware.TenantContext, pod *agentpod.Pod) bool {
	if pod.CreatedByID == tenant.UserID {
		return true
	}
	return ampauthz.RoleHasPermission(tenant.UserRole, ampauthz.PermRunnerManage)
}
