package middleware

import (
	"strings"

	"github.com/l8ai-cn/agentcloud/backend/pkg/apierr"
	authpkg "github.com/l8ai-cn/agentcloud/backend/pkg/auth"
	"github.com/gin-gonic/gin"
)

type JWTClaims = authpkg.Claims
type Claims = JWTClaims

func AuthMiddleware(manager *authpkg.AccessTokenManager, audience string) gin.HandlerFunc {
	return AuthMiddlewareWithAMPBearer(manager, audience, nil)
}

// AuthMiddlewareWithAMPBearer accepts either an Agent Cloud access token or an
// AMP business access token, so a federated user's own IdP credential works on
// every route that already accepts a user session.
func AuthMiddlewareWithAMPBearer(
	manager *authpkg.AccessTokenManager,
	audience string,
	amp AMPBearerAuthenticator,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := bearerToken(c.GetHeader("Authorization"))
		if tokenString == "" {
			tokenString = c.Query("token")
		}
		if tokenString == "" {
			apierr.AbortUnauthorized(c, apierr.AUTH_REQUIRED, "Authorization is required")
			return
		}

		if identity, routed := authenticateAMPBearer(c, amp, tokenString); routed {
			if identity == nil {
				apierr.AbortUnauthorized(c, apierr.INVALID_TOKEN, "Invalid or expired token")
				return
			}
			setAMPIdentity(c, identity)
			c.Next()
			return
		}

		claims, err := validateAccessToken(manager, tokenString, audience)
		if err != nil {
			apierr.AbortUnauthorized(c, apierr.INVALID_TOKEN, "Invalid or expired token")
			return
		}

		setClaims(c, claims)
		c.Next()
	}
}

func OptionalAuthMiddleware(manager *authpkg.AccessTokenManager, audience string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := bearerToken(c.GetHeader("Authorization"))
		if tokenString != "" {
			if claims, err := validateAccessToken(manager, tokenString, audience); err == nil {
				setClaims(c, claims)
			}
		}
		c.Next()
	}
}

func bearerToken(header string) string {
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return ""
	}
	return parts[1]
}

func validateAccessToken(
	manager *authpkg.AccessTokenManager,
	tokenString string,
	audience string,
) (*JWTClaims, error) {
	if manager == nil {
		return nil, authpkg.ErrAccessTokenConfig
	}
	return manager.ValidateToken(tokenString, audience)
}

func setClaims(c *gin.Context, claims *JWTClaims) {
	c.Set("user_id", claims.UserID)
	c.Set("email", claims.Email)
	c.Set("username", claims.Username)
	c.Set("claims", claims)
}
