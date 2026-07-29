package sso

import "context"

type ListQuery struct {
	Search   string   // search by domain or name (ILIKE)
	Protocol Protocol // filter by protocol (empty = all)
}

type Repository interface {
	Create(ctx context.Context, cfg *Config) error
	GetByID(ctx context.Context, id int64) (*Config, error)
	GetByDomainAndProtocol(ctx context.Context, domain string, protocol Protocol) (*Config, error)
	ListByDomain(ctx context.Context, domain string) ([]*Config, error)
	GetEnabledByDomain(ctx context.Context, domain string) ([]*Config, error)
	// ListAMPBearerByIssuerPrefix finds enabled OIDC configs whose issuer lives
	// under the same AMP deployment as a presented token and that delegate
	// bearer trust to at least one application.
	ListAMPBearerByIssuerPrefix(ctx context.Context, issuerPrefix string) ([]*Config, error)
	List(ctx context.Context, query *ListQuery, offset, limit int) ([]*Config, int64, error)
	Update(ctx context.Context, id int64, updates map[string]interface{}) error
	Delete(ctx context.Context, id int64) error
	HasEnforcedSSO(ctx context.Context, domain string) (bool, error)
}
