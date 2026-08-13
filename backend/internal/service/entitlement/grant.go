package entitlement

import (
	"context"
	"errors"
	"fmt"
	"time"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

var (
	ErrNotFound = errors.New("entitlement not found")
	ErrInvalid  = errors.New("entitlement request is invalid")
)

type GrantRequest struct {
	Kind           string
	Key            string
	OrganizationID int64
	SubjectKind    string
	SubjectUserID  *int64
	Effect         string
	Reason         string
	ExpiresAt      *time.Time
	GrantedBy      int64
	IPAddress      string
	UserAgent      string
}

func (s *Service) Grant(ctx context.Context, req GrantRequest) (*entitlementdom.Entitlement, error) {
	row, err := newGrantRow(req)
	if err != nil {
		return nil, err
	}
	existing, err := s.repo.FindBySubject(
		ctx, row.ResourceKind, row.ResourceKey, row.OrganizationID,
		row.SubjectKind, row.SubjectUserID,
	)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		if err := s.repo.Create(ctx, row); err != nil {
			return nil, err
		}
	} else {
		row.ID = existing.ID
		row.CreatedAt = existing.CreatedAt
		if err := s.repo.Update(ctx, row); err != nil {
			return nil, err
		}
	}
	// An allow row is not necessarily permissive: under presence-is-allow-list
	// the first user-level allow flips the resource into whitelist mode and
	// strips everyone else, so every write has to drop the snapshot.
	s.cache.invalidate(row.OrganizationID)
	s.auditGrant(ctx, row, req)
	return row, nil
}

func (s *Service) Revoke(ctx context.Context, id, actorUserID int64, ip, userAgent string) error {
	row, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if row == nil {
		return ErrNotFound
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.cache.invalidate(row.OrganizationID)
	s.auditRevoke(ctx, row, actorUserID, ip, userAgent)
	return nil
}

func (s *Service) ListForOrg(ctx context.Context, orgID int64) ([]entitlementdom.Entitlement, error) {
	return s.repo.ListByOrg(ctx, orgID)
}

func (s *Service) ListForResource(ctx context.Context, kind, key string) ([]entitlementdom.Entitlement, error) {
	return s.repo.ListByResource(ctx, kind, key)
}

func newGrantRow(req GrantRequest) (*entitlementdom.Entitlement, error) {
	if req.Kind != entitlementdom.KindWorkerType && req.Kind != entitlementdom.KindSkill {
		return nil, fmt.Errorf("%w: resource kind", ErrInvalid)
	}
	if err := slugkit.ValidateIdentifier("resource_entitlements.resource_key", req.Key); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalid, err)
	}
	if req.OrganizationID == 0 || req.GrantedBy == 0 {
		return nil, fmt.Errorf("%w: organization or grantor", ErrInvalid)
	}
	if req.Effect != entitlementdom.EffectAllow && req.Effect != entitlementdom.EffectDeny {
		return nil, fmt.Errorf("%w: effect", ErrInvalid)
	}
	if err := validateSubject(req.SubjectKind, req.SubjectUserID); err != nil {
		return nil, err
	}
	now := time.Now()
	return &entitlementdom.Entitlement{
		ResourceKind:   req.Kind,
		ResourceKey:    req.Key,
		OrganizationID: req.OrganizationID,
		SubjectKind:    req.SubjectKind,
		SubjectUserID:  req.SubjectUserID,
		Effect:         req.Effect,
		Reason:         req.Reason,
		ExpiresAt:      req.ExpiresAt,
		GrantedBy:      req.GrantedBy,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func validateSubject(kind string, userID *int64) error {
	switch kind {
	case entitlementdom.SubjectOrg:
		if userID != nil {
			return fmt.Errorf("%w: org subject cannot set user id", ErrInvalid)
		}
		return nil
	case entitlementdom.SubjectUser:
		if userID == nil || *userID == 0 {
			return fmt.Errorf("%w: user subject requires user id", ErrInvalid)
		}
		return nil
	default:
		return fmt.Errorf("%w: subject kind", ErrInvalid)
	}
}
