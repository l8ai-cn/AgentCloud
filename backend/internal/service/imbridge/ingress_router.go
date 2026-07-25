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
