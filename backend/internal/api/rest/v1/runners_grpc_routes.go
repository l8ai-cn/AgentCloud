package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampauthz"
)

// RegisterGRPCRunnerRoutes registers public gRPC runner routes.
func RegisterGRPCRunnerRoutes(r *gin.RouterGroup, handler *GRPCRunnerHandler) {
	grpcPublic := r.Group("/runners/grpc")
	{
		grpcPublic.POST("/auth-url", handler.RequestAuthURL)
		grpcPublic.POST("/register", handler.RegisterWithToken)
		grpcPublic.POST("/reactivate", handler.Reactivate)
		grpcPublic.POST("/renew-certificate", handler.RenewCertificate)
		grpcPublic.GET("/discovery", handler.GetDiscovery)
	}
}

// RegisterOrgGRPCRunnerRoutes registers organization-scoped gRPC runner routes.
func RegisterOrgGRPCRunnerRoutes(rg *gin.RouterGroup, handler *GRPCRunnerHandler) {
	grpc := rg.Group("/grpc")
	{
		manage := middleware.RequirePermission(ampauthz.PermRunnerManage)
		grpc.GET("/tokens", manage, handler.ListGRPCTokens)
		grpc.POST("/tokens", manage, handler.GenerateGRPCToken)
		grpc.DELETE("/tokens/:id", manage, handler.DeleteGRPCToken)
	}
	rg.POST("/:id/reactivate", middleware.RequirePermission(ampauthz.PermRunnerManage), handler.GenerateReactivationToken)
}
