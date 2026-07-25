package v1

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	imbridgesvc "github.com/l8ai-cn/agentcloud/backend/internal/service/imbridge"
	"github.com/l8ai-cn/agentcloud/backend/pkg/apierr"
)

type startWeixinQRRequest struct {
	ConnectionID int64 `json:"connection_id" binding:"required"`
}

func (h *IMBridgeHandler) StartWeixinQRLogin(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	var req startWeixinQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.ValidationError(c, err.Error())
		return
	}
	resp, err := h.bridge.StartWeixinQRLogin(c.Request.Context(), tenant.OrganizationID, req.ConnectionID)
	if err != nil {
		if errors.Is(err, imbridgesvc.ErrNotFound) {
			apierr.ResourceNotFound(c, "IM connection not found")
			return
		}
		apierr.ValidationError(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *IMBridgeHandler) GetWeixinQRLoginStatus(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	sessionID := c.Param("sessionId")
	resp, err := h.bridge.PollWeixinQRLogin(c.Request.Context(), tenant.OrganizationID, sessionID)
	if err != nil {
		if errors.Is(err, imbridgesvc.ErrNotFound) {
			apierr.ResourceNotFound(c, "QR session not found")
			return
		}
		apierr.InternalError(c, "Weixin QR login failed")
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *IMBridgeHandler) GetWeixinQRImage(c *gin.Context) {
	sessionID := c.Param("sessionId")
	mediaType, data, err := h.bridge.GetWeixinQRImage(sessionID)
	if err != nil {
		if errors.Is(err, imbridgesvc.ErrNotFound) {
			apierr.ResourceNotFound(c, "QR session not found")
			return
		}
		apierr.InternalError(c, "QR image unavailable")
		return
	}
	c.Data(http.StatusOK, mediaType, data)
}
