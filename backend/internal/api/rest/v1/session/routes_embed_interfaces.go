package sessionapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/l8ai-cn/agentcloud/backend/pkg/embedtoken"
)

// Skill interfaces are the domain surface a partner front-end talks to, so the
// browser reaches them with the same session-scoped grant it uses for chat —
// never with an org-wide API key.
func registerEmbedInterfaceRoutes(embedded *gin.RouterGroup, d Deps) {
	embedded.GET("/sessions/:id/interfaces", d.handleListSessionInterfaces)
	for _, method := range []string{http.MethodGet, http.MethodHead} {
		embedded.Handle(method, "/sessions/:id/interfaces/:interface_id", d.handleSessionInterfaceProxy)
		embedded.Handle(method, "/sessions/:id/interfaces/:interface_id/*path", d.handleSessionInterfaceProxy)
	}

	writes := embedded.Group("")
	writes.Use(requireEmbedCapability(embedtoken.CapabilityWrite))
	for _, method := range []string{
		http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete,
	} {
		writes.Handle(method, "/sessions/:id/interfaces/:interface_id", d.handleSessionInterfaceProxy)
		writes.Handle(method, "/sessions/:id/interfaces/:interface_id/*path", d.handleSessionInterfaceProxy)
	}
}
