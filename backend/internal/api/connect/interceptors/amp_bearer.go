package interceptors

import (
	"context"
	"log/slog"

	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	"github.com/l8ai-cn/agentcloud/backend/pkg/ampbearer"
)

type ampOrgCtxKey struct{}

// withAMPOrganization records the organization that the presented AMP tenant
// resolves to. ResolveOrgScope compares it against the requested org_slug so a
// valid token from one tenant can never address another tenant's organization —
// the Connect-RPC counterpart of the check in middleware.TenantMiddleware.
func withAMPOrganization(ctx context.Context, orgID int64) context.Context {
	return context.WithValue(ctx, ampOrgCtxKey{}, orgID)
}

func ampOrganizationFromContext(ctx context.Context) (int64, bool) {
	orgID, ok := ctx.Value(ampOrgCtxKey{}).(int64)
	return orgID, ok
}

// RoutesAMPBearer reports whether the credential claims to be an AMP business
// token. Every Connect interceptor must branch on this before trying its own
// validators: routing is decided from unverified claims, so a token that claims
// to be an AMP credential and then fails verification has to be rejected
// outright — falling back would turn a forged claim into a second attempt.
func RoutesAMPBearer(authenticator middleware.AMPBearerAuthenticator, token string) bool {
	return authenticator != nil && ampbearer.IsBusinessToken(token)
}

// InjectAMPTenant is the single AMP identity landing point for Connect-RPC, so
// every service mounted on Connect resolves the federated user, the tenant
// binding and the claims context identically.
func InjectAMPTenant(
	ctx context.Context,
	authenticator middleware.AMPBearerAuthenticator,
	token string,
) (context.Context, error) {
	identity, err := authenticator.AuthenticateAMPBearer(ctx, token)
	if err != nil {
		slog.WarnContext(ctx, "amp bearer authentication rejected", "error", err)
		return ctx, unauthenticated("invalid or expired token")
	}
	ctx = middleware.SetTenant(ctx, &middleware.TenantContext{UserID: identity.UserID})
	ctx = withAMPOrganization(ctx, identity.OrganizationID)
	return withClaims(ctx, &middleware.JWTClaims{
		UserID:   identity.UserID,
		Email:    identity.Email,
		Username: identity.Username,
	}), nil
}
