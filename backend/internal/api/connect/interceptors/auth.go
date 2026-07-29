package interceptors

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	authpkg "github.com/l8ai-cn/agentcloud/backend/pkg/auth"
)

func NewAuthInterceptor(
	manager *authpkg.AccessTokenManager,
	audience string,
	ampBearer middleware.AMPBearerAuthenticator,
) connect.Interceptor {
	return &authInterceptor{manager: manager, audience: audience, ampBearer: ampBearer}
}

type authInterceptor struct {
	manager   *authpkg.AccessTokenManager
	audience  string
	ampBearer middleware.AMPBearerAuthenticator
}

func (a *authInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if req.Spec().IsClient {
			return next(ctx, req)
		}
		ctx, err := a.injectTenant(ctx, req.Header())
		if err != nil {
			return nil, err
		}
		return next(ctx, req)
	}
}

func (a *authInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (a *authInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		ctx, err := a.injectTenant(ctx, conn.RequestHeader())
		if err != nil {
			return err
		}
		return next(ctx, conn)
	}
}

func (a *authInterceptor) injectTenant(ctx context.Context, header http.Header) (context.Context, error) {
	token, err := bearerToken(header.Get("Authorization"))
	if err != nil {
		return ctx, err
	}
	if RoutesAMPBearer(a.ampBearer, token) {
		return InjectAMPTenant(ctx, a.ampBearer, token)
	}
	claims, err := validateAccessToken(token, a.manager, a.audience)
	if err != nil {
		return ctx, err
	}
	ctx = middleware.SetTenant(ctx, &middleware.TenantContext{UserID: claims.UserID})
	return withClaims(ctx, claims), nil
}

func bearerToken(header string) (string, error) {
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" || parts[1] == "" {
		return "", unauthenticated("authorization bearer token is required")
	}
	return parts[1], nil
}

func validateAccessToken(
	token string,
	manager *authpkg.AccessTokenManager,
	audience string,
) (*middleware.JWTClaims, error) {
	if manager == nil {
		return nil, unauthenticated("access token verifier is not configured")
	}
	claims, err := manager.ValidateToken(token, audience)
	if err != nil {
		return nil, unauthenticated("invalid or expired token")
	}
	return claims, nil
}

func unauthenticated(message string) error {
	return connect.NewError(connect.CodeUnauthenticated, errors.New(message))
}
