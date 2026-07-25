package v1

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/sso"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/auth"
	ssoservice "github.com/l8ai-cn/agentcloud/backend/internal/service/sso"
	"github.com/l8ai-cn/agentcloud/backend/pkg/apierr"
	"github.com/gin-gonic/gin"
)

func (h *SSOAuthHandler) OIDCRedirect(c *gin.Context) {
	domain, ok := validateDomain(c)
	if !ok {
		return
	}
	redirectTo := c.Query("redirect")
	if redirectTo == "" {
		redirectTo = h.config.FrontendURL() + "/auth/sso/callback"
	}

	if !h.isAllowedRedirect(redirectTo) {
		apierr.BadRequest(c, apierr.VALIDATION_FAILED, "Invalid redirect URL")
		return
	}

	state, err := h.authService.GenerateOAuthState(c.Request.Context(), "sso_oidc_"+domain, redirectTo)
	if err != nil {
		apierr.InternalError(c, "Failed to generate state")
		return
	}

	authURL, err := h.ssoService.GetAuthURL(c.Request.Context(), domain, sso.ProtocolOIDC, state)
	if err != nil {
		if errors.Is(err, ssoservice.ErrConfigNotFound) {
			apierr.ResourceNotFound(c, "SSO config not found")
			return
		}
		apierr.InternalError(c, "Failed to get auth URL")
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

func (h *SSOAuthHandler) OIDCCallback(c *gin.Context) {
	domain, ok := validateDomain(c)
	if !ok {
		return
	}
	code := c.Query("code")
	state := auth.NormalizeOAuthState(c.Query("state"))

	if code == "" {
		errorMsg := c.Query("error")
		slog.WarnContext(c.Request.Context(), "OIDC callback error",
			"domain", domain,
			"error", errorMsg,
			"error_description", c.Query("error_description"),
		)
		redirectTo := h.config.FrontendURL() + "/auth/sso/callback"
		if state != "" {
			if rt, err := h.authService.ValidateOAuthState(c.Request.Context(), state); err == nil {
				redirectTo = rt
			}
		}
		errorCode := "authentication_failed"
		if errorMsg == "access_denied" {
			errorCode = "access_denied"
		}
		h.redirectWithError(c, redirectTo, errorCode)
		return
	}

	if state == "" {
		redirectTo := h.config.FrontendURL() + "/auth/sso/callback"
		h.redirectWithError(c, redirectTo, "missing_state")
		return
	}

	redirectTo, err := h.authService.ValidateOAuthState(c.Request.Context(), state)
	if err != nil {
		fallbackRedirect := h.config.FrontendURL() + "/auth/sso/callback"
		h.redirectWithError(c, fallbackRedirect, "invalid_state")
		return
	}

	params := map[string]string{"code": code, "state": state}
	userInfo, cfg, err := h.ssoService.HandleCallback(c.Request.Context(), domain, sso.ProtocolOIDC, params)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "OIDC callback handling failed", "domain", domain, "error", err)
		h.redirectWithError(c, redirectTo, "authentication_failed")
		return
	}
	slog.InfoContext(c.Request.Context(), "OIDC assertion accepted",
		"domain", domain, "external_id", userInfo.ExternalID,
		"idp_tenant_id", userInfo.TenantID, "idp_roles", userInfo.Roles,
		"has_email", userInfo.Email != "")

	_, tokens, err := h.authenticateSSO(c, cfg, userInfo)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "OIDC user authentication failed", "domain", domain, "error", err)
		errorCode := "authentication_failed"
		if errors.Is(err, auth.ErrUserDisabled) {
			errorCode = "account_disabled"
		} else if errors.Is(err, auth.ErrSSOTenantUnbound) || errors.Is(err, auth.ErrSSOTenantMismatch) {
			errorCode = "tenant_unbound"
		}
		h.redirectWithError(c, redirectTo, errorCode)
		return
	}
	h.redirectWithTokens(c, redirectTo, tokens)
}
