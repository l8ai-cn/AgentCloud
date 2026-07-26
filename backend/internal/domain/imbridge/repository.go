package imbridge

import "context"

type Repository interface {
	ListConnections(ctx context.Context, orgID int64) ([]*Connection, error)
	ListActiveByProvider(ctx context.Context, provider string) ([]*Connection, error)
	GetConnection(ctx context.Context, orgID, id int64) (*Connection, error)
	GetConnectionByToken(ctx context.Context, provider, token string) (*Connection, error)
	CreateConnection(ctx context.Context, conn *Connection) error
	UpdateConnection(ctx context.Context, conn *Connection) error
	DeleteConnection(ctx context.Context, orgID, id int64) error

	GetThreadMapping(ctx context.Context, connectionID int64, externalThreadID string) (*ThreadMapping, error)
	GetThreadMappingByChannel(ctx context.Context, connectionID, channelID int64) (*ThreadMapping, error)
	UpsertThreadMapping(ctx context.Context, mapping *ThreadMapping) error

	ClaimInboundMessage(ctx context.Context, connectionID int64, externalMessageID string) (bool, error)

	GetIdentityBinding(ctx context.Context, connectionID int64, externalUserID string) (*IdentityBinding, error)
	GetIdentityBindingByCode(ctx context.Context, pairingCode string) (*IdentityBinding, error)
	GetIdentityBindingByID(ctx context.Context, connectionID, bindingID int64) (*IdentityBinding, error)
	ListIdentityBindingViews(ctx context.Context, connectionID int64) ([]*IdentityBindingView, error)
	UpsertIdentityBinding(ctx context.Context, binding *IdentityBinding) error
	UpdateIdentityBinding(ctx context.Context, binding *IdentityBinding) error
	DeleteIdentityBinding(ctx context.Context, connectionID, bindingID int64) error

	ListRouteBindings(ctx context.Context, connectionID int64) ([]*RouteBinding, error)
	CreateRouteBinding(ctx context.Context, binding *RouteBinding) error
	DeleteRouteBinding(ctx context.Context, connectionID, routeID int64) error
}
