package rest

import (
	v1 "github.com/l8ai-cn/agentcloud/backend/internal/api/rest/v1"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
)

// A typed nil pointer stored in an interface is not nil, which would make the
// middleware treat an unconfigured adapter as available and reject every
// Agent Cloud access token. Convert explicitly.
func ampBearerAuthenticator(svc *v1.Services) middleware.AMPBearerAuthenticator {
	if svc == nil || svc.AMPBearerAdapter == nil {
		return nil
	}
	return svc.AMPBearerAdapter
}
