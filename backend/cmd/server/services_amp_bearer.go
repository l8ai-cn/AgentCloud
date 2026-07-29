package main

import "github.com/l8ai-cn/agentcloud/backend/internal/middleware"

// A typed nil pointer stored in an interface is not nil, which would make the
// Connect auth interceptor treat an unconfigured adapter as available and
// reject every Agent Cloud access token. Convert explicitly.
func (s *serviceContainer) ampBearerAuthenticator() middleware.AMPBearerAuthenticator {
	if s == nil || s.ampBearerAdapter == nil {
		return nil
	}
	return s.ampBearerAdapter
}
