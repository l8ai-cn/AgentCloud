package infra

import (
	"context"
	"errors"
	"time"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/grant"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/knowledgebase"
	"gorm.io/gorm"
)

type knowledgeBaseRepo struct {
	db *gorm.DB
}

func NewKnowledgeBaseRepository(db *gorm.DB) knowledgebase.Repository {
	return &knowledgeBaseRepo{db: db}
}

func (r *knowledgeBaseRepo) Create(ctx context.Context, kb *knowledgebase.KnowledgeBase) error {
	return r.db.WithContext(ctx).Create(kb).Error
}

func (r *knowledgeBaseRepo) Get(ctx context.Context, orgID, id int64) (*knowledgebase.KnowledgeBase, error) {
	var kb knowledgebase.KnowledgeBase
	if err := r.db.WithContext(ctx).
		Where("organization_id = ? AND id = ?", orgID, id).
		First(&kb).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, knowledgebase.ErrNotFound
		}
		return nil, err
	}
	return &kb, nil
}

func (r *knowledgeBaseRepo) GetBySlug(ctx context.Context, orgID int64, slug string) (*knowledgebase.KnowledgeBase, error) {
	var kb knowledgebase.KnowledgeBase
	if err := r.db.WithContext(ctx).
		Where("organization_id = ? AND slug = ?", orgID, slug).
		First(&kb).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, knowledgebase.ErrNotFound
		}
		return nil, err
	}
	return &kb, nil
}

const kbVisibilityWithGrantsFilter = "(visibility = 'organization' OR (visibility = 'private' AND created_by_user_id = ?) OR CAST(id AS TEXT) IN (SELECT resource_id FROM resource_grants WHERE resource_type = ? AND user_id = ? AND organization_id = ?))"

func (r *knowledgeBaseRepo) applyVisibility(query *gorm.DB, orgID, userID int64) *gorm.DB {
	if userID == 0 {
		return query
	}
	return query.Where(kbVisibilityWithGrantsFilter, userID, grant.TypeKnowledgeBase, userID, orgID)
}

func (r *knowledgeBaseRepo) List(ctx context.Context, filter *knowledgebase.ListFilter) ([]*knowledgebase.KnowledgeBase, error) {
	query := r.db.WithContext(ctx).Where("organization_id = ?", filter.OrganizationID)
	if filter.SourceType != "" {
		query = query.Where("source_type = ?", filter.SourceType)
	}
	query = r.applyVisibility(query, filter.OrganizationID, filter.VisibilityUserID)
	var kbs []*knowledgebase.KnowledgeBase
	err := query.Order("created_at DESC").Find(&kbs).Error
	return kbs, err
}

func (r *knowledgeBaseRepo) ListExternal(ctx context.Context) ([]*knowledgebase.KnowledgeBase, error) {
	var kbs []*knowledgebase.KnowledgeBase
	err := r.db.WithContext(ctx).
		Where("source_type <> ?", knowledgebase.SourceTypeGit).
		Order("id").
		Find(&kbs).Error
	return kbs, err
}

func (r *knowledgeBaseRepo) ListBySlugs(ctx context.Context, orgID int64, slugs []string, visibilityUserID int64) ([]*knowledgebase.KnowledgeBase, error) {
	if len(slugs) == 0 {
		return nil, nil
	}
	query := r.applyVisibility(
		r.db.WithContext(ctx).Where("organization_id = ? AND slug IN ?", orgID, slugs),
		orgID, visibilityUserID,
	)
	var kbs []*knowledgebase.KnowledgeBase
	err := query.Find(&kbs).Error
	return kbs, err
}

func (r *knowledgeBaseRepo) Update(ctx context.Context, orgID, id int64, updates map[string]any) error {
	updates["updated_at"] = time.Now()
	return r.db.WithContext(ctx).
		Model(&knowledgebase.KnowledgeBase{}).
		Where("organization_id = ? AND id = ?", orgID, id).
		Updates(updates).Error
}

func (r *knowledgeBaseRepo) Delete(ctx context.Context, orgID, id int64) error {
	return r.db.WithContext(ctx).
		Where("organization_id = ? AND id = ?", orgID, id).
		Delete(&knowledgebase.KnowledgeBase{}).Error
}

func (r *knowledgeBaseRepo) SlugExists(ctx context.Context, orgID int64, slug string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&knowledgebase.KnowledgeBase{}).
		Where("organization_id = ? AND slug = ?", orgID, slug).
		Count(&count).Error
	return count > 0, err
}

var _ knowledgebase.Repository = (*knowledgeBaseRepo)(nil)
