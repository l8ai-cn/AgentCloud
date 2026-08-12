package entitlement

import (
	"context"
	"sync"
	"testing"
	"time"

	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/workerdefinition"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSnapshotCacheTTLAndRevokeInvalidation(t *testing.T) {
	now := time.Date(2026, 8, 13, 1, 0, 0, 0, time.UTC)
	clock := &clock{now: now}
	repo := newMemoryRepo()
	svc := NewService(Deps{
		Repo: repo, Now: clock.Now, SnapshotTTL: 30 * time.Second,
		WorkerTypes: fakeWorkers{"closed-agent": "closed"},
	})
	ctx := context.Background()

	decision, err := svc.Decide(ctx, entitlementdom.KindWorkerType, "codex-cli", 1, 9, organization.RoleMember)
	require.NoError(t, err)
	assert.True(t, decision.Allowed)
	assert.Equal(t, 1, repo.listCalls)

	_, err = svc.Grant(ctx, GrantRequest{
		Kind: entitlementdom.KindWorkerType, Key: "codex-cli", OrganizationID: 1,
		SubjectKind: entitlementdom.SubjectUser, SubjectUserID: int64Ptr(2),
		Effect: entitlementdom.EffectAllow, GrantedBy: 1,
	})
	require.NoError(t, err)

	decision, err = svc.Decide(ctx, entitlementdom.KindWorkerType, "codex-cli", 1, 9, organization.RoleMember)
	require.NoError(t, err)
	assert.False(t, decision.Allowed, "the first allow narrows the resource to a whitelist immediately")
	assert.Equal(t, entitlementdom.DenyNotGranted, decision.Reason)
	assert.Equal(t, 2, repo.listCalls)

	clock.now = now.Add(31 * time.Second)
	decision, err = svc.Decide(ctx, entitlementdom.KindWorkerType, "codex-cli", 1, 9, organization.RoleMember)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, 3, repo.listCalls, "the expired snapshot is refetched")

	require.NoError(t, svc.Revoke(ctx, 1, 1, "", ""))
	decision, err = svc.Decide(ctx, entitlementdom.KindWorkerType, "codex-cli", 1, 9, organization.RoleMember)
	require.NoError(t, err)
	assert.True(t, decision.Allowed, "revoke must drop the cache immediately")
	assert.Equal(t, 4, repo.listCalls)
}

func TestGrantAllowIsVisibleToTheGrantedUserImmediately(t *testing.T) {
	repo := newMemoryRepo()
	svc := NewService(Deps{Repo: repo, WorkerTypes: fakeWorkers{"closed-agent": "closed"}})
	ctx := context.Background()

	decision, err := svc.Decide(ctx, entitlementdom.KindWorkerType, "codex-cli", 1, 9, organization.RoleMember)
	require.NoError(t, err)
	require.True(t, decision.Allowed)

	_, err = svc.Grant(ctx, GrantRequest{
		Kind: entitlementdom.KindWorkerType, Key: "codex-cli", OrganizationID: 1,
		SubjectKind: entitlementdom.SubjectUser, SubjectUserID: int64Ptr(2),
		Effect: entitlementdom.EffectAllow, GrantedBy: 1,
	})
	require.NoError(t, err)

	decision, err = svc.Decide(ctx, entitlementdom.KindWorkerType, "codex-cli", 1, 2, organization.RoleMember)
	require.NoError(t, err)
	assert.True(t, decision.Allowed, "the granted member must not wait out the snapshot TTL")

	decision, err = svc.Decide(ctx, entitlementdom.KindWorkerType, "codex-cli", 1, 9, organization.RoleMember)
	require.NoError(t, err)
	assert.False(t, decision.Allowed, "everyone else loses access as soon as the whitelist is armed")
}

func TestGrantDenyInvalidatesSnapshot(t *testing.T) {
	repo := newMemoryRepo()
	svc := NewService(Deps{Repo: repo, SnapshotTTL: time.Hour})
	ctx := context.Background()

	decision, err := svc.Decide(ctx, entitlementdom.KindSkill, "web-search", 3, 4, organization.RoleMember)
	require.NoError(t, err)
	assert.True(t, decision.Allowed)

	_, err = svc.Grant(ctx, GrantRequest{
		Kind: entitlementdom.KindSkill, Key: "web-search", OrganizationID: 3,
		SubjectKind: entitlementdom.SubjectOrg, Effect: entitlementdom.EffectDeny, GrantedBy: 1,
	})
	require.NoError(t, err)

	decision, err = svc.Decide(ctx, entitlementdom.KindSkill, "web-search", 3, 4, organization.RoleAdmin)
	require.NoError(t, err)
	assert.Equal(t, entitlementdom.Deny(entitlementdom.DenyPlatformRevoked), decision)
}

func TestRequireAndClosedWorkerDefault(t *testing.T) {
	svc := NewService(Deps{
		Repo: newMemoryRepo(), WorkerTypes: fakeWorkers{"seedance-expert": "closed"},
	})
	err := svc.Require(context.Background(), 1, 2, organization.RoleMember, entitlementdom.KindWorkerType, "seedance-expert")
	require.Error(t, err)
	var denied *DeniedError
	require.ErrorAs(t, err, &denied)
	assert.Equal(t, entitlementdom.DenyNotEntitled, denied.Reason)
}

type clock struct {
	now time.Time
}

func (c *clock) Now() time.Time { return c.now }

type fakeWorkers map[string]string

func (f fakeWorkers) Get(slug string) (workerdefinition.Definition, bool) {
	value, ok := f[slug]
	if !ok {
		return workerdefinition.Definition{}, false
	}
	return workerdefinition.Definition{
		Slug:        slug,
		Entitlement: workerdefinition.EntitlementPolicy{Default: value},
	}, true
}

func int64Ptr(v int64) *int64 { return &v }

type memoryRepo struct {
	mu        sync.Mutex
	nextID    int64
	rows      []entitlementdom.Entitlement
	skills    map[string]string
	listCalls int
}

func newMemoryRepo() *memoryRepo {
	return &memoryRepo{nextID: 1, skills: map[string]string{}}
}

func (m *memoryRepo) Create(_ context.Context, row *entitlementdom.Entitlement) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	row.ID = m.nextID
	m.nextID++
	clone := *row
	m.rows = append(m.rows, clone)
	return nil
}

func (m *memoryRepo) Update(_ context.Context, row *entitlementdom.Entitlement) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.rows {
		if m.rows[i].ID == row.ID {
			m.rows[i] = *row
			return nil
		}
	}
	return ErrNotFound
}

func (m *memoryRepo) Delete(_ context.Context, id int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	filtered := m.rows[:0]
	for _, row := range m.rows {
		if row.ID != id {
			filtered = append(filtered, row)
		}
	}
	m.rows = filtered
	return nil
}

func (m *memoryRepo) GetByID(_ context.Context, id int64) (*entitlementdom.Entitlement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.rows {
		if m.rows[i].ID == id {
			clone := m.rows[i]
			return &clone, nil
		}
	}
	return nil, nil
}

func (m *memoryRepo) FindBySubject(
	_ context.Context, kind, key string, orgID int64, subjectKind string, subjectUserID *int64,
) (*entitlementdom.Entitlement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.rows {
		row := m.rows[i]
		if row.ResourceKind != kind || row.ResourceKey != key ||
			row.OrganizationID != orgID || row.SubjectKind != subjectKind {
			continue
		}
		if (row.SubjectUserID == nil) != (subjectUserID == nil) {
			continue
		}
		if row.SubjectUserID != nil && *row.SubjectUserID != *subjectUserID {
			continue
		}
		clone := row
		return &clone, nil
	}
	return nil, nil
}

func (m *memoryRepo) ListByOrg(_ context.Context, orgID int64) ([]entitlementdom.Entitlement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.listCalls++
	var out []entitlementdom.Entitlement
	for _, row := range m.rows {
		if row.OrganizationID == orgID {
			out = append(out, row)
		}
	}
	return out, nil
}

func (m *memoryRepo) ListByResource(_ context.Context, kind, key string) ([]entitlementdom.Entitlement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []entitlementdom.Entitlement
	for _, row := range m.rows {
		if row.ResourceKind == kind && row.ResourceKey == key {
			out = append(out, row)
		}
	}
	return out, nil
}

func (m *memoryRepo) PlatformSkillDefaults(_ context.Context) (map[string]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make(map[string]string, len(m.skills))
	for k, v := range m.skills {
		out[k] = v
	}
	return out, nil
}
