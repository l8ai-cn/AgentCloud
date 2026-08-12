package entitlement

import "context"

type Repository interface {
	Create(ctx context.Context, row *Entitlement) error
	Update(ctx context.Context, row *Entitlement) error
	Delete(ctx context.Context, id int64) error
	GetByID(ctx context.Context, id int64) (*Entitlement, error)
	FindBySubject(
		ctx context.Context,
		kind, key string,
		orgID int64,
		subjectKind string,
		subjectUserID *int64,
	) (*Entitlement, error)
	ListByOrg(ctx context.Context, orgID int64) ([]Entitlement, error)
	PlatformSkillDefaults(ctx context.Context) (map[string]string, error)
}
