package sessionapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	podDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/pkg/workerinterface"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func (d *Deps) handleListSessionInterfaces(c *gin.Context) {
	_, pod, ok := d.authorizeInterfaceSession(c)
	if !ok {
		return
	}
	res, ok := d.execSandboxFs(c, pod, &runnerv1.SandboxFsCommand{Op: "list_interfaces"})
	if !ok || fsAPIError(c, res) {
		return
	}
	items := make([]gin.H, 0, len(res.GetEntries()))
	for _, entry := range res.GetEntries() {
		items = append(items, gin.H{"id": entry.GetPath(), "ready": true})
	}
	c.JSON(http.StatusOK, gin.H{"interfaces": items})
}

func (d *Deps) handleSessionInterfaceProxy(c *gin.Context) {
	_, pod, ok := d.authorizeInterfaceSession(c)
	if !ok {
		return
	}
	interfaceID := strings.TrimSpace(c.Param("interface_id"))
	if err := workerinterface.ValidateID(interfaceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	payload, err := workerinterface.EncodeRequest(c.Request, c.Param("path"))
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, workerinterface.ErrBodyTooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		c.JSON(status, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	res, ok := d.execSandboxFs(c, pod, &runnerv1.SandboxFsCommand{
		Op:      "http_proxy",
		Path:    interfaceID,
		Payload: payload,
	})
	if !ok || interfaceProxyError(c, res) {
		return
	}
	proxied, err := workerinterface.DecodeResponse(res.GetEncoding(), res.GetContent())
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	for key, values := range proxied.Headers {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}
	c.Data(proxied.Status, c.Writer.Header().Get("Content-Type"), proxied.Body)
}

// A skill service that has not opened its socket yet is a transient state the
// caller should retry, not a bad request.
func interfaceProxyError(c *gin.Context, res *runnerv1.SandboxFsResultEvent) bool {
	message := res.GetError()
	if message == "" {
		return false
	}
	status := http.StatusBadRequest
	switch {
	case strings.Contains(message, "interface socket not found"):
		status = http.StatusServiceUnavailable
	case strings.Contains(message, "interface proxy failed"):
		status = http.StatusBadGateway
	}
	c.JSON(status, gin.H{"error": gin.H{"message": message}})
	return true
}

func (d *Deps) authorizeInterfaceSession(c *gin.Context) (string, *podDomain.Pod, bool) {
	row, pod, ok := d.authorizeSession(c, c.Param("id"))
	if !ok {
		return "", nil, false
	}
	if pod == nil || !pod.IsActive() {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "pod_not_active", "message": "worker is not active"},
		})
		return "", nil, false
	}
	return row.ID, pod, true
}
