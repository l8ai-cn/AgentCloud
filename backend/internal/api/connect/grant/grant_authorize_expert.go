package grantconnect

import (
	"context"
	"errors"
	"strconv"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
)

func (s *Server) authorizeExpertAccess(
	ctx context.Context, sub policy.Subject, orgID int64, resourceID string,
) error {
	if s.expertSvc == nil {
		return connect.NewError(connect.CodeNotFound, errors.New("expert not found"))
	}
	expertID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("invalid expert id"))
	}
	row, err := s.expertSvc.GetByID(ctx, orgID, expertID)
	if err != nil || row == nil {
		return connect.NewError(connect.CodeNotFound, errors.New("expert not found"))
	}
	owner := row.CreatedByID
	if !policy.ExpertPolicy.AllowWrite(sub, policy.VisibleResource(row.OrganizationID, &owner, "")) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("forbidden"))
	}
	return nil
}
