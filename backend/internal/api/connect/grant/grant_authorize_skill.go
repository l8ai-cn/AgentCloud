package grantconnect

import (
	"context"
	"errors"
	"strconv"

	"connectrpc.com/connect"

	"github.com/l8ai-cn/agentcloud/backend/pkg/policy"
)

// authorizeSkillAccess covers organization-owned skills only. Platform-level
// skills carry a NULL organization_id, so the org-scoped lookup misses them —
// they are Layer 1 (entitlements), never resource_grants.
func (s *Server) authorizeSkillAccess(
	ctx context.Context, sub policy.Subject, orgID int64, resourceID string,
) error {
	if s.skillSvc == nil {
		return connect.NewError(connect.CodeNotFound, errors.New("skill not found"))
	}
	skillID, err := strconv.ParseInt(resourceID, 10, 64)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("invalid skill id"))
	}
	row, err := s.skillSvc.GetByID(ctx, orgID, skillID)
	if err != nil || row == nil || row.OrganizationID == nil {
		return connect.NewError(connect.CodeNotFound, errors.New("skill not found"))
	}
	if !policy.SkillPolicy.AllowWrite(sub, policy.VisibleResource(*row.OrganizationID, row.CreatedByID, "")) {
		return connect.NewError(connect.CodePermissionDenied, errors.New("forbidden"))
	}
	return nil
}
