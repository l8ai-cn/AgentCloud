package infra

import (
	"context"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/executioncluster"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type executionClusterRepository struct{ db *gorm.DB }

func NewExecutionClusterRepository(db *gorm.DB) executioncluster.Repository {
	return &executionClusterRepository{db: db}
}

func (r *executionClusterRepository) ListByOrganization(ctx context.Context, organizationID int64) ([]*executioncluster.Cluster, error) {
	var clusters []*executioncluster.Cluster
	if err := r.db.WithContext(ctx).
		Where("organization_id = ?", organizationID).
		Order("kind ASC").
		Find(&clusters).Error; err != nil {
		return nil, err
	}
	return clusters, nil
}

func (r *executionClusterRepository) GetByIDAndOrganization(ctx context.Context, id, organizationID int64) (*executioncluster.Cluster, error) {
	var cluster executioncluster.Cluster
	if err := r.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, organizationID).
		First(&cluster).Error; err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return &cluster, nil
}

func (r *executionClusterRepository) EnsureDefaults(ctx context.Context, organizationID int64) ([]*executioncluster.Cluster, error) {
	db := r.db.WithContext(ctx)

	if err := db.Exec(`
		UPDATE execution_clusters
		SET slug = ?, name = ?, updated_at = CURRENT_TIMESTAMP
		WHERE organization_id = ?
		  AND slug = 'online'
		  AND NOT EXISTS (
			SELECT 1 FROM execution_clusters AS existing
			WHERE existing.organization_id = ?
			  AND existing.slug = ?
		  )
	`, executioncluster.SlugDefault, executioncluster.NameDefault, organizationID, organizationID, executioncluster.SlugDefault).Error; err != nil {
		return nil, err
	}

	if err := db.Exec(`
		UPDATE execution_clusters
		SET name = ?, updated_at = CURRENT_TIMESTAMP
		WHERE organization_id = ? AND slug = ? AND name <> ?
	`, executioncluster.NameDefault, organizationID, executioncluster.SlugDefault, executioncluster.NameDefault).Error; err != nil {
		return nil, err
	}

	cluster := &executioncluster.Cluster{
		OrganizationID: organizationID,
		Slug:           slugkit.Slug(executioncluster.SlugDefault),
		Name:           executioncluster.NameDefault,
		Kind:           executioncluster.KindOnline,
		Status:         executioncluster.StatusPending,
	}
	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "organization_id"}, {Name: "slug"}},
		DoNothing: true,
	}).Create(cluster).Error; err != nil {
		return nil, err
	}

	if err := db.Exec(`
		UPDATE runner_grpc_registration_tokens AS token
		SET cluster_id = default_cluster.id
		FROM execution_clusters AS default_cluster
		JOIN execution_clusters AS local_cluster
		  ON local_cluster.organization_id = default_cluster.organization_id
		 AND local_cluster.slug = 'local'
		WHERE default_cluster.organization_id = ?
		  AND default_cluster.slug = ?
		  AND token.organization_id = ?
		  AND token.cluster_id = local_cluster.id
	`, organizationID, executioncluster.SlugDefault, organizationID).Error; err != nil {
		return nil, err
	}

	if err := db.Exec(`
		UPDATE runner_pending_auths AS pending
		SET cluster_id = default_cluster.id
		FROM execution_clusters AS default_cluster
		JOIN execution_clusters AS local_cluster
		  ON local_cluster.organization_id = default_cluster.organization_id
		 AND local_cluster.slug = 'local'
		WHERE default_cluster.organization_id = ?
		  AND default_cluster.slug = ?
		  AND pending.organization_id = ?
		  AND pending.cluster_id = local_cluster.id
	`, organizationID, executioncluster.SlugDefault, organizationID).Error; err != nil {
		return nil, err
	}

	if err := db.Exec(`
		DELETE FROM execution_clusters
		WHERE organization_id = ?
		  AND slug = 'local'
		  AND NOT EXISTS (
			SELECT 1 FROM runners WHERE runners.cluster_id = execution_clusters.id
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM pods WHERE pods.cluster_id = execution_clusters.id
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM runner_grpc_registration_tokens
			WHERE runner_grpc_registration_tokens.cluster_id = execution_clusters.id
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM runner_pending_auths
			WHERE runner_pending_auths.cluster_id = execution_clusters.id
		  )
	`, organizationID).Error; err != nil {
		return nil, err
	}

	return r.ListByOrganization(ctx, organizationID)
}
