package middleware

import (
	"context"
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/l8ai-cn/agentcloud/backend/pkg/ampbearer"
)

const (
	AuthTypeAMPBearer = "amp_bearer"
	ampOrgIDKey       = "amp_organization_id"
)

type AMPBearerIdentity struct {
	UserID         int64
	Email          string
	Username       string
	OrganizationID int64
	TenantID       string
	AppCode        string
}

type AMPBearerAuthenticator interface {
	AuthenticateAMPBearer(ctx context.Context, rawToken string) (*AMPBearerIdentity, error)
}

// authenticateAMPBearer reports whether the credential was routed to the AMP
// branch. Routing is decided from unverified claims, so a token that claims to be
// an AMP credential and then fails verification is rejected outright: falling
// through to the local validator would turn a forged claim into a second attempt.
func authenticateAMPBearer(
	c *gin.Context,
	authenticator AMPBearerAuthenticator,
	tokenString string,
) (*AMPBearerIdentity, bool) {
	if authenticator == nil || !ampbearer.IsBusinessToken(tokenString) {
		return nil, false
	}
	identity, err := authenticator.AuthenticateAMPBearer(c.Request.Context(), tokenString)
	if err != nil {
		slog.WarnContext(c.Request.Context(), "amp bearer authentication rejected",
			"error", err)
		return nil, true
	}
	return identity, true
}

func setAMPIdentity(c *gin.Context, identity *AMPBearerIdentity) {
	c.Set("user_id", identity.UserID)
	c.Set("email", identity.Email)
	c.Set("username", identity.Username)
	c.Set("auth_type", AuthTypeAMPBearer)
	c.Set(ampOrgIDKey, identity.OrganizationID)
}

// ampOrganizationID is the organization the presented AMP tenant resolves to.
// TenantMiddleware compares it with the requested organization so a valid token
// from one tenant can never address another tenant's organization.
func ampOrganizationID(c *gin.Context) (int64, bool) {
	value, exists := c.Get(ampOrgIDKey)
	if !exists {
		return 0, false
	}
	orgID, ok := value.(int64)
	return orgID, ok
}
