package airesource

import (
	"context"
	"slices"
	"strconv"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
)

type GrantQuerier interface {
	GetGrantedUserIDs(ctx context.Context, resourceType, resourceID string) ([]int64, error)
	GetGrantedResourceIDs(ctx context.Context, resourceType string, userID, orgID int64) ([]string, error)
	GetRestrictedResourceIDs(ctx context.Context, resourceType string, resourceIDs []string) ([]string, error)
}

type connectionGrantContext struct {
	orgCanManage bool
	userGranted  map[int64]bool
	restricted   map[int64]bool
}

func (s *Service) authorizeConnectionUse(ctx context.Context, actor Actor, connection *domain.Connection, orgCanManage bool) error {
	if connection.OwnerScope != domain.OwnerScopeOrg {
		return nil
	}
	if orgCanManage {
		return nil
	}
	// resource_grants.resource_id stores provider_connection ID because credentials are shared across every model on that connection.
	grantedUserIDs, err := s.grants.GetGrantedUserIDs(ctx, grant.TypeModelConnection, grant.IntResourceID(connection.ID))
	if err != nil {
		return err
	}
	if len(grantedUserIDs) == 0 {
		return nil
	}
	if slices.Contains(grantedUserIDs, actor.UserID) {
		return nil
	}
	return ErrNotGranted
}

func (s *Service) loadConnectionGrantContext(
	ctx context.Context, actor Actor, orgID int64, orgCanManage bool, connectionIDs []int64,
) (*connectionGrantContext, error) {
	ctxData := &connectionGrantContext{orgCanManage: orgCanManage, userGranted: map[int64]bool{}, restricted: map[int64]bool{}}
	if orgID <= 0 || orgCanManage || len(connectionIDs) == 0 {
		return ctxData, nil
	}
	grantedIDs, err := s.grants.GetGrantedResourceIDs(ctx, grant.TypeModelConnection, actor.UserID, orgID)
	if err != nil {
		return nil, err
	}
	for _, idStr := range grantedIDs {
		id, parseErr := strconv.ParseInt(idStr, 10, 64)
		if parseErr != nil {
			continue
		}
		ctxData.userGranted[id] = true
	}
	resourceIDs := make([]string, 0, len(connectionIDs))
	for _, connectionID := range connectionIDs {
		resourceIDs = append(resourceIDs, grant.IntResourceID(connectionID))
	}
	restricted, err := s.grants.GetRestrictedResourceIDs(ctx, grant.TypeModelConnection, resourceIDs)
	if err != nil {
		return nil, err
	}
	for _, idStr := range restricted {
		id, parseErr := strconv.ParseInt(idStr, 10, 64)
		if parseErr != nil {
			continue
		}
		ctxData.restricted[id] = true
	}
	return ctxData, nil
}

func (c *connectionGrantContext) canUse(connection *domain.Connection) bool {
	if connection.OwnerScope != domain.OwnerScopeOrg {
		return true
	}
	if c.orgCanManage {
		return true
	}
	if !c.restricted[connection.ID] {
		return true
	}
	return c.userGranted[connection.ID]
}
