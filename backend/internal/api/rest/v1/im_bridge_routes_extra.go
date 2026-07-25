package v1

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
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
	binding, err := h.bridge.PairWithCode(c.Request.Context(), tenant.UserID, req.Code)
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

func (h *IMBridgeHandler) ListRouteBindings(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	id, err := strconv.ParseInt(c.Param("connectionId"), 10, 64)
	if err != nil {
		apierr.ValidationError(c, "invalid connection id")
		return
	}
	rows, err := h.bridge.ListRouteBindings(c.Request.Context(), tenant.OrganizationID, id)
	if err != nil {
		h.notFoundOrInternal(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"routes": rows})
}

type createRouteBindingRequest struct {
	PeerKind       string  `json:"peer_kind"`
	PeerID         *string `json:"peer_id"`
	TargetKind     string  `json:"target_kind"`
	TargetRef      string  `json:"target_ref" binding:"required"`
	RequireMention bool    `json:"require_mention"`
	Priority       int     `json:"priority"`
}

func (h *IMBridgeHandler) CreateRouteBinding(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	id, err := strconv.ParseInt(c.Param("connectionId"), 10, 64)
	if err != nil {
		apierr.ValidationError(c, "invalid connection id")
		return
	}
	var req createRouteBindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.ValidationError(c, err.Error())
		return
	}
	row, err := h.bridge.CreateRouteBinding(c.Request.Context(), tenant.OrganizationID, id, &imbridge.RouteBinding{
		PeerKind:       req.PeerKind,
		PeerID:         req.PeerID,
		TargetKind:     req.TargetKind,
		TargetRef:      req.TargetRef,
		RequireMention: req.RequireMention,
		Priority:       req.Priority,
	})
	if err != nil {
		h.notFoundOrInternal(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"route": row})
}

func (h *IMBridgeHandler) DeleteRouteBinding(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	id, err := strconv.ParseInt(c.Param("connectionId"), 10, 64)
	if err != nil {
		apierr.ValidationError(c, "invalid connection id")
		return
	}
	routeID, err := strconv.ParseInt(c.Param("routeId"), 10, 64)
	if err != nil {
		apierr.ValidationError(c, "invalid route id")
		return
	}
	if err := h.bridge.DeleteRouteBinding(c.Request.Context(), tenant.OrganizationID, id, routeID); err != nil {
		h.notFoundOrInternal(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
