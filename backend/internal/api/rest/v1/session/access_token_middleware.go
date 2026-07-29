package sessionapi

import (
	"github.com/gin-gonic/gin"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
)

func accessTokenMiddleware(d Deps) gin.HandlerFunc {
	if d.Auth == nil {
		return middleware.AuthMiddlewareWithAMPBearer(nil, "", d.AMPBearer)
	}
	return middleware.AuthMiddlewareWithAMPBearer(
		d.Auth.AccessTokenManager(),
		d.Auth.AccessTokenAudience(),
		d.AMPBearer,
	)
}
