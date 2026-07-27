package v1

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	agentpoddomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	sessiondomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentsession"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	sessionsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/agentsession"
	usersvc "github.com/l8ai-cn/agentcloud/backend/internal/service/user"
	"github.com/l8ai-cn/agentcloud/backend/pkg/apierr"
	"github.com/l8ai-cn/agentcloud/backend/pkg/embedtoken"
)

// WorkerEmbedContextHandler lets a third-party server hand its own browser a
// scoped view of a worker's conversation without ever holding a user JWT.
//
// The external API deliberately narrows the session-permission model to plain
// ownership: an API key may only embed workers launched under its own
// identity. Grant-based sharing stays on the JWT surface, where the full
// permission engine lives.
type WorkerEmbedContextHandler struct {
	sessions *sessionsvc.Service
	tokens   *embedtoken.Service
	users    *usersvc.Service
	pods     embedWorkerPodLookup
}

type embedWorkerPodLookup interface {
	GetPod(ctx context.Context, podKey string) (*agentpoddomain.Pod, error)
}

func NewWorkerEmbedContextHandler(
	sessions *sessionsvc.Service,
	tokens *embedtoken.Service,
	users *usersvc.Service,
	pods embedWorkerPodLookup,
) *WorkerEmbedContextHandler {
	return &WorkerEmbedContextHandler{
		sessions: sessions,
		tokens:   tokens,
		users:    users,
		pods:     pods,
	}
}

type createWorkerEmbedContextRequest struct {
	ParentOrigins []string `json:"parent_origins"`
	Capabilities  []string `json:"capabilities"`
}

func (h *WorkerEmbedContextHandler) CreateEmbedContext(c *gin.Context) {
	if h.sessions == nil || h.tokens == nil {
		apierr.ServiceUnavailable(
			c,
			apierr.SERVICE_UNAVAILABLE,
			"Embed contexts are unavailable",
		)
		return
	}
	tenant := middleware.GetTenant(c)
	if tenant == nil {
		apierr.Unauthorized(c, apierr.AUTH_REQUIRED, "Unauthorized")
		return
	}
	var request createWorkerEmbedContextRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		apierr.ValidationError(c, err.Error())
		return
	}
	origins, capabilities, ok := parseWorkerEmbedGrant(c, request)
	if !ok {
		return
	}
	session, ok := h.ownedSession(c, tenant)
	if !ok {
		return
	}
	grant, err := h.tokens.IssueContext(c.Request.Context(), embedtoken.ContextInput{
		SessionID:            session.ID,
		OrganizationID:       tenant.OrganizationID,
		OrganizationSlug:     tenant.OrganizationSlug,
		UserID:               tenant.UserID,
		Email:                h.viewerEmail(c.Request.Context(), tenant.UserID),
		Capabilities:         capabilities,
		AllowedParentOrigins: origins,
	})
	if err != nil {
		if errors.Is(err, embedtoken.ErrContextStore) {
			apierr.ServiceUnavailable(
				c,
				apierr.SERVICE_UNAVAILABLE,
				"Embed contexts are unavailable",
			)
			return
		}
		apierr.InternalError(c, "Embed context could not be issued")
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"embed_context":    grant.Token,
		"redemption_proof": grant.RedemptionProof,
		"expires_at":       grant.ExpiresAt.Unix(),
		"session_id":       session.ID,
		"pod_key":          session.PodKey,
		"capabilities":     capabilities,
		"parent_origins":   origins,
	})
}

func parseWorkerEmbedGrant(
	c *gin.Context,
	request createWorkerEmbedContextRequest,
) ([]string, []string, bool) {
	origins, err := embedtoken.ValidateOrigins(request.ParentOrigins)
	if err != nil {
		apierr.ValidationError(c, err.Error())
		return nil, nil, false
	}
	capabilities, err := embedtoken.ValidateCapabilities(request.Capabilities)
	if err != nil {
		apierr.ValidationError(c, err.Error())
		return nil, nil, false
	}
	return origins, capabilities, true
}

func (h *WorkerEmbedContextHandler) ownedSession(
	c *gin.Context,
	tenant *middleware.TenantContext,
) (*sessiondomain.Session, bool) {
	session, err := h.sessions.GetByPodKey(c.Request.Context(), c.Param("key"))
	if err != nil || session == nil ||
		session.OrganizationID != tenant.OrganizationID {
		apierr.ResourceNotFound(c, "Worker not found")
		return nil, false
	}
	if session.UserID != tenant.UserID {
		apierr.Forbidden(
			c,
			apierr.ACCESS_DENIED,
			"This API key can only embed workers it launched",
		)
		return nil, false
	}
	if !h.workerIsEmbeddable(c, session.PodKey) {
		return nil, false
	}
	return session, true
}

func (h *WorkerEmbedContextHandler) workerIsEmbeddable(
	c *gin.Context,
	podKey string,
) bool {
	if h.pods == nil {
		apierr.ServiceUnavailable(
			c,
			apierr.SERVICE_UNAVAILABLE,
			"Embed contexts are unavailable",
		)
		return false
	}
	pod, err := h.pods.GetPod(c.Request.Context(), podKey)
	if err != nil || pod == nil {
		apierr.ResourceNotFound(c, "Worker not found")
		return false
	}
	if !pod.IsActive() {
		apierr.Conflict(
			c,
			apierr.INVALID_INPUT,
			"Worker is not active",
		)
		return false
	}
	return true
}

func (h *WorkerEmbedContextHandler) viewerEmail(
	ctx context.Context,
	userID int64,
) string {
	if h.users == nil {
		return ""
	}
	viewer, err := h.users.GetByID(ctx, userID)
	if err != nil || viewer == nil {
		return ""
	}
	return viewer.Email
}
