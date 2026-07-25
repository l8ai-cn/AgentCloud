package infra

import (
	"context"
	"errors"
	"time"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (r *imBridgeRepository) ClaimInboundMessage(ctx context.Context, connectionID int64, externalMessageID string) (bool, error) {
	if externalMessageID == "" {
		return true, nil
	}
	res := r.db.WithContext(ctx).Exec(
		`INSERT INTO im_inbound_dedupe (connection_id, external_message_id, seen_at)
		 VALUES (?, ?, ?)
		 ON CONFLICT (connection_id, external_message_id) DO NOTHING`,
		connectionID, externalMessageID, time.Now().UTC(),
	)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

func (r *imBridgeRepository) GetIdentityBinding(ctx context.Context, connectionID int64, externalUserID string) (*domain.IdentityBinding, error) {
	var row domain.IdentityBinding
	err := r.db.WithContext(ctx).
		Where("connection_id = ? AND external_user_id = ?", connectionID, externalUserID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *imBridgeRepository) GetIdentityBindingByCode(ctx context.Context, pairingCode string) (*domain.IdentityBinding, error) {
	var row domain.IdentityBinding
	err := r.db.WithContext(ctx).
		Where("pairing_code = ? AND status = ?", pairingCode, domain.BindingPending).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *imBridgeRepository) ListIdentityBindings(ctx context.Context, connectionID int64) ([]*domain.IdentityBinding, error) {
	var rows []*domain.IdentityBinding
	err := r.db.WithContext(ctx).Where("connection_id = ?", connectionID).Order("id ASC").Find(&rows).Error
	return rows, err
}

func (r *imBridgeRepository) UpsertIdentityBinding(ctx context.Context, binding *domain.IdentityBinding) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "connection_id"}, {Name: "external_user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"external_name", "user_id", "status", "pairing_code", "pairing_expires_at", "updated_at",
		}),
	}).Create(binding).Error
}

func (r *imBridgeRepository) UpdateIdentityBinding(ctx context.Context, binding *domain.IdentityBinding) error {
	return r.db.WithContext(ctx).Save(binding).Error
}

func (r *imBridgeRepository) ListRouteBindings(ctx context.Context, connectionID int64) ([]*domain.RouteBinding, error) {
	var rows []*domain.RouteBinding
	err := r.db.WithContext(ctx).
		Where("connection_id = ?", connectionID).
		Order("priority ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *imBridgeRepository) CreateRouteBinding(ctx context.Context, binding *domain.RouteBinding) error {
	return r.db.WithContext(ctx).Create(binding).Error
}

func (r *imBridgeRepository) DeleteRouteBinding(ctx context.Context, connectionID, routeID int64) error {
	return r.db.WithContext(ctx).
		Where("connection_id = ? AND id = ?", connectionID, routeID).
		Delete(&domain.RouteBinding{}).Error
}
