package entitlement

import (
	"context"
	"time"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
)

type Deps struct {
	Repo          entitlementdom.Repository
	WorkerTypes   WorkerTypeLookup
	PlatformAudit PlatformAuditor
	OrgAudit      OrgAuditor
	Now           func() time.Time
	SnapshotTTL   time.Duration
}

type Service struct {
	repo          entitlementdom.Repository
	workerTypes   WorkerTypeLookup
	platformAudit PlatformAuditor
	orgAudit      OrgAuditor
	now           func() time.Time
	cache         *snapshotCache
}

func NewService(deps Deps) *Service {
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	return &Service{
		repo:          deps.Repo,
		workerTypes:   deps.WorkerTypes,
		platformAudit: deps.PlatformAudit,
		orgAudit:      deps.OrgAudit,
		now:           now,
		cache:         newSnapshotCache(deps.SnapshotTTL),
	}
}

func (s *Service) SnapshotFor(ctx context.Context, orgID int64) (Snapshot, error) {
	if snap, ok := s.cache.get(orgID, s.now()); ok {
		return snap, nil
	}
	rows, err := s.repo.ListByOrg(ctx, orgID)
	if err != nil {
		return nil, err
	}
	skills, err := s.repo.PlatformSkillDefaults(ctx)
	if err != nil {
		return nil, err
	}
	snap := &orgSnapshot{
		now:     s.now,
		byKey:   groupByResource(rows),
		workers: s.workerTypes,
		skills:  skills,
	}
	s.cache.put(orgID, snap, s.now())
	return snap, nil
}

func (s *Service) Decide(
	ctx context.Context,
	kind, key string,
	orgID, userID int64,
	role string,
) (entitlementdom.Decision, error) {
	snap, err := s.SnapshotFor(ctx, orgID)
	if err != nil {
		return entitlementdom.Decision{}, err
	}
	return snap.Decide(kind, key, userID, role), nil
}

func (s *Service) Require(
	ctx context.Context,
	orgID, userID int64,
	role, kind, key string,
) error {
	decision, err := s.Decide(ctx, kind, key, orgID, userID, role)
	if err != nil {
		return err
	}
	if decision.Allowed {
		return nil
	}
	return &DeniedError{Kind: kind, Key: key, Reason: decision.Reason}
}
