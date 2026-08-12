package knowledgebaseconnect

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	kbdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	kbservice "github.com/l8ai-cn/agentcloud/backend/internal/service/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
)

func (s *Server) subject(ctx context.Context) policy.Subject {
	tenant := middleware.GetTenant(ctx)
	return policy.NewSubject(tenant.OrganizationID, tenant.UserID, tenant.UserRole)
}

func (s *Server) resourceWithGrants(ctx context.Context, kb *kbdomain.KnowledgeBase) policy.ResourceContext {
	ownerID := kb.CreatedByUserID
	rc := policy.VisibleResource(kb.OrganizationID, &ownerID, kb.Visibility)
	if s.grantSvc == nil {
		return rc
	}
	ids, err := s.grantSvc.GetGrantedUserIDs(
		ctx, grant.TypeKnowledgeBase, grant.IntResourceID(kb.ID),
	)
	if err == nil && len(ids) > 0 {
		return rc.WithGrants(ids)
	}
	return rc
}

func (s *Server) denyUnlessRead(ctx context.Context, kb *kbdomain.KnowledgeBase) error {
	if !policy.KnowledgeBasePolicy.AllowRead(s.subject(ctx), s.resourceWithGrants(ctx, kb)) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("access denied"))
	}
	return nil
}

func (s *Server) denyUnlessWrite(ctx context.Context, kb *kbdomain.KnowledgeBase) error {
	if !policy.KnowledgeBasePolicy.AllowWrite(s.subject(ctx), s.resourceWithGrants(ctx, kb)) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("access denied"))
	}
	return nil
}

func parseVisibility(v string) (string, error) {
	if v == "" {
		return kbdomain.VisibilityOrganization, nil
	}
	if !kbdomain.ValidVisibility(v) {
		return "", fmt.Errorf("%w: visibility must be organization or private", kbservice.ErrInvalidInput)
	}
	return v, nil
}
