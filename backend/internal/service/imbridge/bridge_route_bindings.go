package imbridge

import (
	"context"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (b *Bridge) ListRouteBindings(ctx context.Context, orgID, connectionID int64) ([]*domain.RouteBinding, error) {
	if _, err := b.GetConnection(ctx, orgID, connectionID); err != nil {
		return nil, err
	}
	return b.repo.ListRouteBindings(ctx, connectionID)
}

func (b *Bridge) CreateRouteBinding(ctx context.Context, orgID, connectionID int64, route *domain.RouteBinding) (*domain.RouteBinding, error) {
	if _, err := b.GetConnection(ctx, orgID, connectionID); err != nil {
		return nil, err
	}
	route.ConnectionID = connectionID
	if route.PeerKind == "" {
		route.PeerKind = domain.PeerAny
	}
	if route.TargetKind == "" {
		route.TargetKind = domain.TargetPod
	}
	if route.Priority == 0 {
		route.Priority = 100
	}
	if err := b.repo.CreateRouteBinding(ctx, route); err != nil {
		return nil, err
	}
	return route, nil
}

func (b *Bridge) DeleteRouteBinding(ctx context.Context, orgID, connectionID, routeID int64) error {
	if _, err := b.GetConnection(ctx, orgID, connectionID); err != nil {
		return err
	}
	return b.repo.DeleteRouteBinding(ctx, connectionID, routeID)
}
