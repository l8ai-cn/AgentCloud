package workercreation

import (
	"context"
	"sync"
	"testing"
	"time"

	agentdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agent"
	entitlementdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/organization"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/workerdefinition"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWorkerTypeEntitlementNilGatePreservesLegacyBehavior(t *testing.T) {
	service := entitlementTestService(t, nil, nil)
	scope := specservice.Scope{OrgID: 7, UserID: 9}

	_, err := service.workerTypes.ResolveWorkerType(
		context.Background(),
		scope,
		slugkit.MustNewForTest("codex-cli"),
	)
	require.NoError(t, err)
	require.NoError(t, service.AssertWorkerTypeEntitled(context.Background(), 7, 9, "codex-cli"))

	options, err := service.listWorkerTypeOptions(context.Background(), scope, "")
	require.NoError(t, err)
	require.Len(t, options, 1)
	assert.True(t, options[0].Selectable)
}

func TestWorkerTypeEntitlementDefaultOpenAllowsMembers(t *testing.T) {
	gate := entitlementTestGate(t, entitlementWorkerDefaults{}, nil)
	service := entitlementTestService(t, gate, staticMemberRoles{})

	_, err := service.workerTypes.ResolveWorkerType(
		context.Background(),
		specservice.Scope{OrgID: 7, UserID: 9},
		slugkit.MustNewForTest("codex-cli"),
	)
	require.NoError(t, err)
}

func TestWorkerTypeEntitlementDefaultClosedRejectsAndHidesOption(t *testing.T) {
	gate := entitlementTestGate(t, entitlementWorkerDefaults{"closed-agent": "closed"}, nil)
	service := entitlementTestService(t, gate, staticMemberRoles{})
	scope := specservice.Scope{OrgID: 7, UserID: 9}

	agents := &workerOptionsAgentProvider{agents: []*agentdomain.Agent{
		activeWorkerTypeAgentFor("codex-cli", "codex", codexEntitlementAgentSource()),
		activeWorkerTypeAgentFor("closed-agent", "closed", codexEntitlementAgentSource()),
	}}
	service.agents = agents
	service.SetEntitlements(gate)
	service.workerTypes = newWorkerTypeResolver(
		agents,
		entitlementTestDefinitions(),
		gate,
		staticMemberRoles{},
	)

	_, err := service.workerTypes.ResolveWorkerType(
		context.Background(),
		scope,
		slugkit.MustNewForTest("closed-agent"),
	)
	require.Error(t, err)
	require.ErrorIs(t, err, specservice.ErrInvalidDraft)

	options, err := service.listWorkerTypeOptions(context.Background(), scope, "")
	require.NoError(t, err)
	require.Len(t, options, 1)
	assert.Equal(t, "codex-cli", options[0].Slug)
}

func TestWorkerTypeEntitlementWhitelistShowsBlockedOption(t *testing.T) {
	member := int64(9)
	other := int64(10)
	gate := entitlementTestGate(t, entitlementWorkerDefaults{}, []entitlementdom.Entitlement{
		entitlementUserAllow("codex-cli", 7, other),
	})
	service := entitlementTestService(t, gate, staticMemberRoles{})
	scope := specservice.Scope{OrgID: 7, UserID: member}

	options, err := service.listWorkerTypeOptions(context.Background(), scope, "")
	require.NoError(t, err)
	require.Len(t, options, 1)
	assert.False(t, options[0].Selectable)
	assert.Equal(t, BlockingNotEntitled, options[0].BlockingReason)
}

func TestValidateWorkerTypeSnapshotRejectsAfterEntitlementRevoke(t *testing.T) {
	fixture := newWorkerCreationServiceFixture()
	gate := entitlementTestGate(t, entitlementWorkerDefaults{}, nil)
	service := NewService(fixture.deps())
	service.SetEntitlements(gate)
	service.workerTypes = newWorkerTypeResolver(
		fixture.agents,
		fixture.definitions,
		gate,
		nil,
	)
	scope := specservice.Scope{OrgID: 77, UserID: 7}
	prepared, err := service.Prepare(context.Background(), scope, validWorkerCreationDraft())
	require.NoError(t, err)

	_, err = gate.Grant(context.Background(), entitlementsvc.GrantRequest{
		Kind: entitlementdom.KindWorkerType, Key: "codex-cli", OrganizationID: 77,
		SubjectKind: entitlementdom.SubjectOrg, Effect: entitlementdom.EffectDeny, GrantedBy: 1,
	})
	require.NoError(t, err)

	err = service.ValidateWorkerTypeSnapshot(
		context.Background(),
		scope,
		prepared.Spec.Runtime.WorkerType,
	)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrWorkerTypeDefinitionChanged)
}

func entitlementTestService(
	t *testing.T,
	gate *entitlementsvc.Service,
	roles MemberRoleReader,
) *Service {
	t.Helper()
	source := codexEntitlementAgentSource()
	agents := &workerOptionsAgentProvider{agents: []*agentdomain.Agent{
		activeWorkerTypeAgentFor("codex-cli", "codex", source),
	}}
	service := NewService(Deps{
		Catalog:     enabledCodexRuntimeCatalog(),
		Definitions: entitlementTestDefinitions(),
		Agents:      agents,
		Runners:     workerOptionsRunnerAvailability{available: true},
		MemberRoles: roles,
	})
	service.SetEntitlements(gate)
	return service
}

func entitlementTestGate(
	t *testing.T,
	workers entitlementWorkerDefaults,
	seed []entitlementdom.Entitlement,
) *entitlementsvc.Service {
	t.Helper()
	repo := newEntitlementTestRepo(seed)
	return entitlementsvc.NewService(entitlementsvc.Deps{
		Repo: repo, WorkerTypes: workers, SnapshotTTL: time.Hour,
	})
}

func entitlementTestDefinitions() staticWorkerDefinitions {
	source := codexEntitlementAgentSource()
	return staticWorkerDefinitions{
		"codex-cli": workerDefinition("codex-cli", "codex", source, "pty", "acp"),
		"closed-agent": func() workerdefinition.Definition {
			def := workerDefinition("closed-agent", "closed", source, "pty", "acp")
			def.Entitlement = workerdefinition.EntitlementPolicy{Default: "closed"}
			return def
		}(),
	}
}

func codexEntitlementAgentSource() string {
	return "AGENT codex\nEXECUTABLE codex\nMODE acp\n"
}

type entitlementWorkerDefaults map[string]string

func (defaults entitlementWorkerDefaults) Get(slug string) (workerdefinition.Definition, bool) {
	value, ok := defaults[slug]
	if !ok {
		return workerdefinition.Definition{}, false
	}
	return workerdefinition.Definition{
		Slug: slug, Entitlement: workerdefinition.EntitlementPolicy{Default: value},
	}, true
}

type staticMemberRoles map[int64]string

func (roles staticMemberRoles) GetMemberRole(_ context.Context, _, userID int64) (string, error) {
	if role, ok := roles[userID]; ok {
		return role, nil
	}
	return organization.RoleMember, nil
}

func entitlementUserAllow(key string, orgID, userID int64) entitlementdom.Entitlement {
	id := userID
	return entitlementdom.Entitlement{
		ResourceKind: entitlementdom.KindWorkerType, ResourceKey: key,
		OrganizationID: orgID, SubjectKind: entitlementdom.SubjectUser,
		SubjectUserID: &id, Effect: entitlementdom.EffectAllow, GrantedBy: 1,
	}
}

type entitlementTestRepo struct {
	mu     sync.Mutex
	nextID int64
	rows   []entitlementdom.Entitlement
}

func newEntitlementTestRepo(seed []entitlementdom.Entitlement) *entitlementTestRepo {
	repo := &entitlementTestRepo{nextID: 1}
	repo.rows = append(repo.rows, seed...)
	return repo
}

func (repo *entitlementTestRepo) Create(_ context.Context, row *entitlementdom.Entitlement) error {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	row.ID = repo.nextID
	repo.nextID++
	repo.rows = append(repo.rows, *row)
	return nil
}

func (repo *entitlementTestRepo) Update(_ context.Context, row *entitlementdom.Entitlement) error {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	for i := range repo.rows {
		if repo.rows[i].ID == row.ID {
			repo.rows[i] = *row
			return nil
		}
	}
	return entitlementsvc.ErrNotFound
}

func (repo *entitlementTestRepo) Delete(_ context.Context, id int64) error {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	filtered := repo.rows[:0]
	for _, row := range repo.rows {
		if row.ID != id {
			filtered = append(filtered, row)
		}
	}
	repo.rows = filtered
	return nil
}

func (repo *entitlementTestRepo) GetByID(_ context.Context, id int64) (*entitlementdom.Entitlement, error) {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	for i := range repo.rows {
		if repo.rows[i].ID == id {
			row := repo.rows[i]
			return &row, nil
		}
	}
	return nil, nil
}

func (repo *entitlementTestRepo) FindBySubject(
	_ context.Context, kind, key string, orgID int64, subjectKind string, subjectUserID *int64,
) (*entitlementdom.Entitlement, error) {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	for i := range repo.rows {
		row := repo.rows[i]
		if row.ResourceKind != kind || row.ResourceKey != key ||
			row.OrganizationID != orgID || row.SubjectKind != subjectKind {
			continue
		}
		if (row.SubjectUserID == nil) != (subjectUserID == nil) {
			continue
		}
		if row.SubjectUserID != nil && subjectUserID != nil &&
			*row.SubjectUserID != *subjectUserID {
			continue
		}
		copy := row
		return &copy, nil
	}
	return nil, nil
}

func (repo *entitlementTestRepo) ListByOrg(_ context.Context, orgID int64) ([]entitlementdom.Entitlement, error) {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	var out []entitlementdom.Entitlement
	for _, row := range repo.rows {
		if row.OrganizationID == orgID {
			out = append(out, row)
		}
	}
	return out, nil
}

func (repo *entitlementTestRepo) PlatformSkillDefaults(context.Context) (map[string]string, error) {
	return map[string]string{}, nil
}
