package v1

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/pkg/apierr"
)

type pairIMRequest struct {
	Code string `json:"code" binding:"required"`
}

func (h *IMBridgeHandler) PairIdentity(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	var req pairIMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.ValidationError(c, err.Error())
		return
	}
	binding, err := h.bridge.PairWithCode(c.Request.Context(), tenant.OrganizationID, tenant.UserID, req.Code)
	if err != nil {
		h.notFoundOrInternal(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"binding": binding})
}

func (h *IMBridgeHandler) ListIdentityBindings(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	id, err := strconv.ParseInt(c.Param("connectionId"), 10, 64)
	if err != nil {
		apierr.ValidationError(c, "invalid connection id")
		return
	}
	rows, err := h.bridge.ListIdentityBindings(c.Request.Context(), tenant.OrganizationID, id)
	if err != nil {
		h.notFoundOrInternal(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"bindings": rows})
}

type updateIdentityBindingRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *IMBridgeHandler) UpdateIdentityBinding(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	connectionID, bindingID, ok := h.bindingParams(c)
	if !ok {
		return
	}
	var req updateIdentityBindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.ValidationError(c, err.Error())
		return
	}
	binding, err := h.bridge.SetIdentityBindingStatus(
		c.Request.Context(), tenant.OrganizationID, connectionID, bindingID, req.Status)
	if err != nil {
		h.notFoundOrInternal(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"binding": binding})
}

func (h *IMBridgeHandler) DeleteIdentityBinding(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	connectionID, bindingID, ok := h.bindingParams(c)
	if !ok {
		return
	}
	if err := h.bridge.DeleteIdentityBinding(
		c.Request.Context(), tenant.OrganizationID, connectionID, bindingID); err != nil {
		h.notFoundOrInternal(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *IMBridgeHandler) bindingParams(c *gin.Context) (connectionID, bindingID int64, ok bool) {
	connectionID, err := strconv.ParseInt(c.Param("connectionId"), 10, 64)
	if err != nil {
		apierr.ValidationError(c, "invalid connection id")
		return 0, 0, false
	}
	bindingID, err = strconv.ParseInt(c.Param("bindingId"), 10, 64)
	if err != nil {
		apierr.ValidationError(c, "invalid binding id")
		return 0, 0, false
	}
	return connectionID, bindingID, true
}
