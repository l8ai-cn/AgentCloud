package authconnect

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"

	authservice "github.com/l8ai-cn/agentcloud/backend/internal/service/auth"
	authv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/auth/v1"
)

// Login mirrors REST POST /api/v1/auth/login. Public RPC — no bearer token
// required (the caller is authenticating to obtain one).
func (s *Server) Login(
	ctx context.Context, req *connect.Request[authv1.LoginRequest],
) (*connect.Response[authv1.LoginResponse], error) {
	if req.Msg.GetUsername() == "" || req.Msg.GetPassword() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("username and password are required"))
	}
	result, err := s.authSvc.Login(ctx, req.Msg.GetUsername(), req.Msg.GetPassword())
	if err != nil {
		switch {
		case errors.Is(err, authservice.ErrInvalidCredentials):
			return nil, connect.NewError(connect.CodeUnauthenticated,
				errors.New("invalid username or password"))
		case errors.Is(err, authservice.ErrUserDisabled):
			return nil, connect.NewError(connect.CodePermissionDenied,
				errors.New("user is disabled"))
		case errors.Is(err, authservice.ErrSSOEnforced):
			return nil, connect.NewError(connect.CodePermissionDenied,
				errors.New("SSO login is required for this domain"))
		default:
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}
	return connect.NewResponse(&authv1.LoginResponse{
		Token:        result.Token,
		RefreshToken: result.RefreshToken,
		ExpiresIn:    result.ExpiresIn,
		User:         toProtoUser(result.User),
	}), nil
}

// Register is kept mounted so clients get an explicit FailedPrecondition
// instead of a missing-procedure 404. Local signup is closed; use AMP/SSO.
func (s *Server) Register(
	context.Context, *connect.Request[authv1.RegisterRequest],
) (*connect.Response[authv1.RegisterResponse], error) {
	return nil, connect.NewError(connect.CodeFailedPrecondition,
		authservice.ErrRegistrationDisabled)
}

// RefreshToken mirrors REST POST /api/v1/auth/refresh.
func (s *Server) RefreshToken(
	ctx context.Context, req *connect.Request[authv1.RefreshTokenRequest],
) (*connect.Response[authv1.RefreshTokenResponse], error) {
	if req.Msg.GetRefreshToken() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("refresh_token is required"))
	}
	result, err := s.authSvc.RefreshToken(ctx, req.Msg.GetRefreshToken())
	if err != nil {
		if errors.Is(err, authservice.ErrInvalidToken) ||
			errors.Is(err, authservice.ErrInvalidRefreshToken) {
			return nil, connect.NewError(connect.CodeUnauthenticated,
				errors.New("invalid refresh token"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&authv1.RefreshTokenResponse{
		Token:        result.Token,
		RefreshToken: result.RefreshToken,
		ExpiresIn:    result.ExpiresIn,
	}), nil
}

// Logout mirrors REST POST /api/v1/auth/logout. The Authorization header
// is mandatory (interceptor enforces it); the raw bearer token is then
// blacklisted in Redis so subsequent requests with that token fail.
func (s *SessionServer) Logout(
	ctx context.Context, req *connect.Request[authv1.LogoutRequest],
) (*connect.Response[authv1.LogoutResponse], error) {
	header := req.Header().Get("Authorization")
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 && parts[0] == "Bearer" && parts[1] != "" {
		if s.authSvc == nil || s.previewSessions == nil {
			return nil, connect.NewError(
				connect.CodeUnavailable,
				errors.New("logout service unavailable"),
			)
		}
		claims, err := s.authSvc.ValidateTokenWithContext(ctx, parts[1])
		if err == nil {
			if err := s.previewSessions.RevokeUser(ctx, claims.UserID); err != nil {
				return nil, connect.NewError(connect.CodeUnavailable, err)
			}
			if err := s.authSvc.RevokeToken(ctx, parts[1]); err != nil {
				return nil, connect.NewError(connect.CodeUnavailable, err)
			}
		}
	}
	return connect.NewResponse(&authv1.LogoutResponse{
		Message: "Logged out successfully",
	}), nil
}
