package grantconnect

import (
	"context"
	"errors"
	"strconv"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	kbdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
)

func (s *Server) authorizeKnowledgeBaseAccess(
	ctx context.Context, sub policy.Subject, orgID int64, resourceID string,
) error {
	if s.kbSvc == nil {
		return connect.NewError(connect.CodeNotFound, errors.New("knowledge base not found"))
	}
	kbID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("invalid knowledge base id"))
	}
	kb, err := s.kbSvc.Get(ctx, orgID, kbID)
	if err != nil {
		return connect.NewError(connect.CodeNotFound, errors.New("knowledge base not found"))
	}
	ownerID := kb.CreatedByUserID
	rc := policy.VisibleResource(kb.OrganizationID, &ownerID, kb.Visibility)
	if s.grantSvc != nil {
		if ids, gerr := s.grantSvc.GetGrantedUserIDs(
			ctx, grant.TypeKnowledgeBase, grant.IntResourceID(kb.ID),
		); gerr == nil && len(ids) > 0 {
			rc = rc.WithGrants(ids)
		}
	}
	if !policy.KnowledgeBasePolicy.AllowWrite(sub, rc) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("forbidden"))
	}
	return nil
}

var _ KnowledgeBaseLookup = (interface {
	Get(ctx context.Context, orgID, id int64) (*kbdom.KnowledgeBase, error)
})(nil)
