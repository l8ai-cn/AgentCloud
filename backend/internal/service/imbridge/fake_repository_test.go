package imbridge

import (
	"context"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

type fakeRepository struct {
	threadMapping *domain.ThreadMapping
	routeBindings []*domain.RouteBinding
	upserted      []*domain.ThreadMapping
}

func (r *fakeRepository) GetThreadMapping(context.Context, int64, string) (*domain.ThreadMapping, error) {
	return r.threadMapping, nil
}

func (r *fakeRepository) UpsertThreadMapping(_ context.Context, mapping *domain.ThreadMapping) error {
	r.upserted = append(r.upserted, mapping)
	return nil
}

func (r *fakeRepository) ListRouteBindings(context.Context, int64) ([]*domain.RouteBinding, error) {
	return r.routeBindings, nil
}

func (r *fakeRepository) ListConnections(context.Context, int64) ([]*domain.Connection, error) {
	return nil, nil
}

func (r *fakeRepository) ListActiveByProvider(context.Context, string) ([]*domain.Connection, error) {
	return nil, nil
}

func (r *fakeRepository) GetConnection(context.Context, int64, int64) (*domain.Connection, error) {
	return nil, nil
}

func (r *fakeRepository) GetConnectionByToken(context.Context, string, string) (*domain.Connection, error) {
	return nil, nil
}

func (r *fakeRepository) CreateConnection(context.Context, *domain.Connection) error { return nil }
func (r *fakeRepository) UpdateConnection(context.Context, *domain.Connection) error { return nil }
func (r *fakeRepository) DeleteConnection(context.Context, int64, int64) error       { return nil }

func (r *fakeRepository) GetThreadMappingByChannel(context.Context, int64, int64) (*domain.ThreadMapping, error) {
	return r.threadMapping, nil
}

func (r *fakeRepository) ClaimInboundMessage(context.Context, int64, string) (bool, error) {
	return true, nil
}

func (r *fakeRepository) GetIdentityBinding(context.Context, int64, string) (*domain.IdentityBinding, error) {
	return nil, nil
}

func (r *fakeRepository) GetIdentityBindingByCode(context.Context, string) (*domain.IdentityBinding, error) {
	return nil, nil
}

func (r *fakeRepository) ListIdentityBindings(context.Context, int64) ([]*domain.IdentityBinding, error) {
	return nil, nil
}

func (r *fakeRepository) UpsertIdentityBinding(context.Context, *domain.IdentityBinding) error {
	return nil
}

func (r *fakeRepository) UpdateIdentityBinding(context.Context, *domain.IdentityBinding) error {
	return nil
}

func (r *fakeRepository) CreateRouteBinding(context.Context, *domain.RouteBinding) error { return nil }

func (r *fakeRepository) DeleteRouteBinding(context.Context, int64, int64) error { return nil }

func newTestBridge(repo *fakeRepository) *Bridge {
	return &Bridge{Service: &Service{repo: repo}}
}
