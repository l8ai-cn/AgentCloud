package ampidentity

import (
	"context"

	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
)

var _ middleware.AMPBearerAuthenticator = (*MiddlewareAdapter)(nil)

type MiddlewareAdapter struct {
	authenticator *Authenticator
}

func NewMiddlewareAdapter(authenticator *Authenticator) *MiddlewareAdapter {
	return &MiddlewareAdapter{authenticator: authenticator}
}

func (a *MiddlewareAdapter) AuthenticateAMPBearer(
	ctx context.Context,
	rawToken string,
) (*middleware.AMPBearerIdentity, error) {
	identity, err := a.authenticator.Authenticate(ctx, rawToken)
	if err != nil {
		return nil, err
	}
	return &middleware.AMPBearerIdentity{
		UserID:         identity.UserID,
		Email:          identity.Email,
		Username:       identity.Username,
		OrganizationID: identity.OrganizationID,
		TenantID:       identity.TenantID,
		AppCode:        identity.AppCode,
	}, nil
}
