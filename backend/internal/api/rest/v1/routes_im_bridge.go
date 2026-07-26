package v1

import "github.com/gin-gonic/gin"

func registerIMBridgeRoutes(rg *gin.RouterGroup, svc *Services) {
	if svc.IMBridge == nil {
		return
	}
	h := NewIMBridgeHandler(svc.IMBridge)
	group := rg.Group("/im-channels")
	{
		group.GET("/providers", h.ListProviders)
		group.POST("/pair", h.PairIdentity)
		group.POST("/weixin/qr/start", h.StartWeixinQRLogin)
		group.GET("/weixin/qr/:sessionId/status", h.GetWeixinQRLoginStatus)
		group.GET("/weixin/qr/:sessionId/image", h.GetWeixinQRImage)
		group.GET("", h.ListConnections)
		group.POST("", h.CreateConnection)
		group.GET("/:connectionId", h.GetConnection)
		group.PATCH("/:connectionId", h.UpdateConnection)
		group.DELETE("/:connectionId", h.DeleteConnection)
		group.GET("/:connectionId/bindings", h.ListIdentityBindings)
		group.PATCH("/:connectionId/bindings/:bindingId", h.UpdateIdentityBinding)
		group.DELETE("/:connectionId/bindings/:bindingId", h.DeleteIdentityBinding)
		group.GET("/:connectionId/routes", h.ListRouteBindings)
		group.POST("/:connectionId/routes", h.CreateRouteBinding)
		group.DELETE("/:connectionId/routes/:routeId", h.DeleteRouteBinding)
	}
}
