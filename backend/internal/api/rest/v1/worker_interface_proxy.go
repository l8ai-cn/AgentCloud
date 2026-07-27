package v1

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	podDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/pkg/apierr"
	"github.com/l8ai-cn/agentcloud/backend/pkg/workerinterface"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func (h *PodHandler) ListWorkerInterfaces(c *gin.Context) {
	pod, ok := h.authorizeActiveInterfacePod(c)
	if !ok {
		return
	}
	result, ok := h.execPodWorkspace(c, pod, &runnerv1.SandboxFsCommand{
		PodKey: pod.PodKey,
		Op:     "list_interfaces",
	})
	if !ok {
		return
	}
	items := make([]gin.H, 0, len(result.GetEntries()))
	for _, entry := range result.GetEntries() {
		items = append(items, gin.H{
			"id":     entry.GetPath(),
			"ready":  true,
			"socket": ".agent/run/" + entry.GetPath() + ".sock",
		})
	}
	c.JSON(http.StatusOK, gin.H{"interfaces": items})
}

func (h *PodHandler) ProxyWorkerInterface(c *gin.Context) {
	pod, ok := h.authorizeActiveInterfacePod(c)
	if !ok {
		return
	}
	interfaceID := strings.TrimSpace(c.Param("interface_id"))
	if err := workerinterface.ValidateID(interfaceID); err != nil {
		apierr.BadRequest(c, apierr.VALIDATION_FAILED, err.Error())
		return
	}
	payload, err := workerinterface.EncodeRequest(c.Request, c.Param("path"))
	if err != nil {
		writeInterfaceRequestError(c, err)
		return
	}
	result, ok := h.execPodWorkspace(c, pod, &runnerv1.SandboxFsCommand{
		PodKey:  pod.PodKey,
		Op:      "http_proxy",
		Path:    interfaceID,
		Payload: payload,
	})
	if !ok {
		return
	}
	proxied, err := workerinterface.DecodeResponse(result.GetEncoding(), result.GetContent())
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": gin.H{"message": err.Error()},
		})
		return
	}
	for key, values := range proxied.Headers {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}
	c.Data(proxied.Status, c.Writer.Header().Get("Content-Type"), proxied.Body)
}

func writeInterfaceRequestError(c *gin.Context, err error) {
	if errors.Is(err, workerinterface.ErrBodyTooLarge) {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": gin.H{"message": err.Error()},
		})
		return
	}
	apierr.BadRequest(c, apierr.VALIDATION_FAILED, err.Error())
}

func (h *PodHandler) authorizeActiveInterfacePod(c *gin.Context) (*podDomain.Pod, bool) {
	pod, ok := h.authorizeReadablePod(c)
	if !ok {
		return nil, false
	}
	if !podDomain.IsPodStatusRelayConnectable(pod.Status) {
		apierr.Conflict(c, "pod_not_active", "Pod is not active")
		return nil, false
	}
	return pod, true
}
