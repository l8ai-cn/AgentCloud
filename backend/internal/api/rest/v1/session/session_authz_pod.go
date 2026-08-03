package sessionapi

import (
	"github.com/gin-gonic/gin"

	podDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentsession"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
)

func (d *Deps) sessionAccessLevelFromPod(
	c *gin.Context,
	tenant *middleware.TenantContext,
	row *domain.Session,
) int {
	sub := policy.NewSubject(tenant.OrganizationID, tenant.UserID, tenant.UserRole)
	if policy.AllowAdmin(sub, row.OrganizationID) {
		return levelEdit
	}
	pod := d.linkedPod(c, row)
	if pod == nil {
		return 0
	}
	rc := d.podResourceContext(c, pod)
	if policy.PodPolicy.AllowWrite(sub, rc) {
		return levelEdit
	}
	if policy.PodPolicy.AllowRead(sub, rc) {
		return levelRead
	}
	return 0
}

func (d *Deps) linkedPod(c *gin.Context, row *domain.Session) *podDomain.Pod {
	if d.Pod == nil || row == nil || row.PodKey == "" {
		return nil
	}
	pod, err := d.Pod.GetPod(c.Request.Context(), row.PodKey)
	if err != nil || pod == nil {
		return nil
	}
	if pod.OrganizationID != row.OrganizationID {
		return nil
	}
	return pod
}

func (d *Deps) podResourceContext(c *gin.Context, pod *podDomain.Pod) policy.ResourceContext {
	rc := policy.PodResource(pod.OrganizationID, pod.CreatedByID)
	if d.Grants == nil {
		return rc
	}
	ids, err := d.Grants.GetGrantedUserIDs(c.Request.Context(), grant.TypePod, pod.PodKey)
	if err != nil || len(ids) == 0 {
		return rc
	}
	return rc.WithGrants(ids)
}
