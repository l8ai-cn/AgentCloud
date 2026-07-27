package v1

import (
	"net/http"

	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

var interfaceWriteMethods = []string{
	http.MethodPost,
	http.MethodPut,
	http.MethodPatch,
	http.MethodDelete,
}

// registerExtPodWorkerRoutes mounts the same handlers at /pods and /workers.
// "Worker" is the product term; "Pod" remains a route alias.
func registerExtPodWorkerRoutes(
	rg *gin.RouterGroup,
	podHandler *PodHandler,
	embedHandler *WorkerEmbedContextHandler,
) {
	for _, base := range []string{"/pods", "/workers"} {
		read := rg.Group(base)
		read.Use(middleware.RequireScope("pods:read", "pods:write"))
		{
			read.GET("", podHandler.ListPods)
			read.GET("/:key", podHandler.GetPod)
			read.GET("/:key/workspace/files", podHandler.ListWorkspaceFilesystem)
			read.GET("/:key/workspace/files/*filepath", podHandler.ListWorkspaceFilesystem)
			read.GET("/:key/workspace/search", podHandler.SearchWorkspaceFilesystem)
			read.GET("/:key/interfaces", podHandler.ListWorkerInterfaces)
			for _, method := range []string{http.MethodGet, http.MethodHead} {
				read.Handle(method, "/:key/interfaces/:interface_id", podHandler.ProxyWorkerInterface)
				read.Handle(method, "/:key/interfaces/:interface_id/*path", podHandler.ProxyWorkerInterface)
			}
		}
		write := rg.Group(base)
		write.Use(middleware.RequireScope("pods:write"))
		{
			write.POST("", podHandler.CreatePod)
			write.POST("/:key/prompt", podHandler.SendPodPrompt)
			write.POST("/:key/terminate", podHandler.TerminatePod)
			// A skill interface may mutate workspace state, so anything beyond a
			// read must carry the write scope even though the transport is shared.
			for _, method := range interfaceWriteMethods {
				write.Handle(method, "/:key/interfaces/:interface_id", podHandler.ProxyWorkerInterface)
				write.Handle(method, "/:key/interfaces/:interface_id/*path", podHandler.ProxyWorkerInterface)
			}
		}
		if embedHandler == nil {
			continue
		}
		embed := rg.Group(base)
		embed.Use(middleware.RequireScope("sessions:embed"))
		{
			embed.POST("/:key/embed-context", embedHandler.CreateEmbedContext)
		}
	}
}
