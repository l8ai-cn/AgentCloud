package infra

import (
	"context"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"gorm.io/gorm"
)

type entitlementRepo struct {
	db *gorm.DB
}

func NewEntitlementRepository(db *gorm.DB) entitlement.Repository {
	return &entitlementRepo{db: db}
}

func (r *entitlementRepo) Create(ctx context.Context, row *entitlement.Entitlement) error {
	return r.db.WithContext(ctx).Create(row).Error
}

func (r *entitlementRepo) Update(ctx context.Context, row *entitlement.Entitlement) error {
	return r.db.WithContext(ctx).Save(row).Error
}

func (r *entitlementRepo) Delete(ctx context.Context, id int64) error {
	result := r.db.WithContext(ctx).Delete(&entitlement.Entitlement{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *entitlementRepo) GetByID(ctx context.Context, id int64) (*entitlement.Entitlement, error) {
	var row entitlement.Entitlement
	err := r.db.WithContext(ctx).First(&row, id).Error
	if isNotFound(err) {
		return nil, nil
	}
	return &row, err
}

func (r *entitlementRepo) FindBySubject(
	ctx context.Context,
	kind, key string,
	orgID int64,
	subjectKind string,
	subjectUserID *int64,
) (*entitlement.Entitlement, error) {
	query := r.db.WithContext(ctx).Where(
		"resource_kind = ? AND resource_key = ? AND organization_id = ? AND subject_kind = ?",
		kind, key, orgID, subjectKind,
	)
	if subjectUserID == nil {
		query = query.Where("subject_user_id IS NULL")
	} else {
		query = query.Where("subject_user_id = ?", *subjectUserID)
	}
	var row entitlement.Entitlement
	err := query.First(&row).Error
	if isNotFound(err) {
		return nil, nil
	}
	return &row, err
}

func (r *entitlementRepo) ListByOrg(ctx context.Context, orgID int64) ([]entitlement.Entitlement, error) {
	var rows []entitlement.Entitlement
	err := r.db.WithContext(ctx).
		Where("organization_id = ?", orgID).
		Order("id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *entitlementRepo) PlatformSkillDefaults(ctx context.Context) (map[string]string, error) {
	type skillDefault struct {
		Slug               string
		EntitlementDefault string `gorm:"column:entitlement_default"`
	}
	var rows []skillDefault
	err := r.db.WithContext(ctx).
		Table("skills").
		Select("slug, entitlement_default").
		Where("organization_id IS NULL").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	defaults := make(map[string]string, len(rows))
	for _, row := range rows {
		defaults[row.Slug] = row.EntitlementDefault
	}
	return defaults, nil
}

var _ entitlement.Repository = (*entitlementRepo)(nil)
