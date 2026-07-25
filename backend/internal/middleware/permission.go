package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampauthz"
	"github.com/l8ai-cn/agentcloud/backend/pkg/apierr"
)

func requirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tc := GetTenant(c)
		if tc == nil {
			apierr.AbortUnauthorized(c, apierr.AUTH_REQUIRED, "Tenant context not found")
			return
		}
		if !ampauthz.RoleHasPermission(tc.UserRole, permission) {
			apierr.AbortForbidden(c, apierr.INSUFFICIENT_PERMISSIONS, "Insufficient permissions")
			return
		}
		c.Next()
	}
}
