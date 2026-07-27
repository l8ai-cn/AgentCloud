package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"

	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func (h *PodHandler) SearchWorkspaceFilesystem(c *gin.Context) {
	pod, ok := h.authorizeReadablePod(c)
	if !ok {
		return
	}
	result, ok := h.execPodWorkspace(c, pod, &runnerv1.SandboxFsCommand{
		PodKey:      pod.PodKey,
		Op:          "search",
		Payload:     c.Query("q"),
		IncludeGlob: c.Query("include"),
		ExcludeGlob: c.Query("exclude"),
	})
	if !ok {
		return
	}
	c.JSON(http.StatusOK, podWorkspaceListWire(result.GetEntries(), result.GetWorkspaceRoot()))
}
