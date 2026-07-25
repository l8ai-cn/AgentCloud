package imbridge

import (
	"context"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type routeResolution struct {
	TargetKind string
	TargetRef  string
}

func (b *Bridge) resolveRoute(ctx context.Context, conn *domain.Connection, event *InboundEvent, mapping *domain.ThreadMapping) (*routeResolution, error) {
	if mapping != nil && mapping.ActiveTargetRef != nil && strings.TrimSpace(*mapping.ActiveTargetRef) != "" {
		return &routeResolution{TargetKind: domain.TargetPod, TargetRef: *mapping.ActiveTargetRef}, nil
	}
	if refs := slugMentionRe.FindAllStringSubmatch(event.Text, -1); len(refs) > 0 {
		return &routeResolution{TargetKind: domain.TargetPod, TargetRef: refs[0][1]}, nil
	}
	routes, err := b.repo.ListRouteBindings(ctx, conn.ID)
	if err != nil {
		return nil, err
	}
	peer := inferPeerKind(event)
	var fallback *domain.RouteBinding
	for _, route := range routes {
		if route.PeerKind == domain.PeerAny {
			if fallback == nil {
				fallback = route
			}
			continue
		}
		if route.PeerKind != peer {
			continue
		}
		if route.PeerID != nil && *route.PeerID != "" && *route.PeerID != event.ExternalThreadID {
			continue
		}
		if route.RequireMention && !slugMentionRe.MatchString(event.Text) {
			continue
		}
		return &routeResolution{TargetKind: route.TargetKind, TargetRef: route.TargetRef}, nil
	}
	if fallback != nil {
		return &routeResolution{TargetKind: fallback.TargetKind, TargetRef: fallback.TargetRef}, nil
	}
	return nil, nil
}

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

func applyRouteMention(text string, route *routeResolution) string {
	if route == nil || route.TargetKind != domain.TargetPod || route.TargetRef == "" {
		return text
	}
	mention := "@" + route.TargetRef
	if strings.Contains(text, mention) {
		return text
	}
	return mention + " " + text
}
