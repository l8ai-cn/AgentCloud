package workerskill

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	skilldomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

const testOrgID int64 = 42

type fakeSnapshots struct {
	current specdomain.Snapshot
	created []specdomain.Spec
	nextID  int64
}

func (f *fakeSnapshots) GetByID(_ context.Context, orgID, id int64) (specdomain.Snapshot, error) {
	if orgID != f.current.OrganizationID || id != f.current.ID {
		return specdomain.Snapshot{}, specdomain.ErrNotFound
	}
	return f.current, nil
}

func (f *fakeSnapshots) Create(
	_ context.Context, resolved specservice.ResolvedSnapshot,
) (specdomain.Snapshot, error) {
	spec, err := specdomain.DecodeSpec(resolved.SpecJSON())
	if err != nil {
		return specdomain.Snapshot{}, err
	}
	f.created = append(f.created, spec)
	f.nextID++
	return specdomain.Snapshot{
		ID:             f.current.ID + f.nextID,
		OrganizationID: resolved.OrganizationID(),
		Spec:           spec,
	}, nil
}

type fakePods struct {
	field string
	value interface{}
	err   error
}

func (f *fakePods) UpdateField(_ context.Context, _, field string, value interface{}) error {
	f.field, f.value = field, value
	return f.err
}

type fakeCatalog map[int64]*skilldomain.Skill

func (f fakeCatalog) GetAnyByID(_ context.Context, id int64) (*skilldomain.Skill, error) {
	row, ok := f[id]
	if !ok {
		return nil, skilldomain.ErrNotFound
	}
	return row, nil
}

type fakeSigner struct{ err error }

func (f fakeSigner) GetWorkerSkillsByPackages(
	_ context.Context, packages []specdomain.SkillPackageBinding, _ string,
) ([]*extensionservice.ResolvedSkill, error) {
	if f.err != nil {
		return nil, f.err
	}
	resolved := make([]*extensionservice.ResolvedSkill, 0, len(packages))
	for _, pkg := range packages {
		resolved = append(resolved, &extensionservice.ResolvedSkill{
			CatalogSkillID: pkg.SkillID,
			Slug:           pkg.Slug,
			ContentSha:     pkg.ContentSHA,
			DownloadURL:    "https://packages.test/" + pkg.Slug,
			PackageSize:    pkg.PackageSize,
		})
	}
	return resolved, nil
}

type fakeCommands struct {
	calls             int
	add               []*runnerv1.ResourceToDownload
	removeTargetPaths []string
	err               error
}

func (f *fakeCommands) SendUpdatePodSkills(
	_ context.Context, _ int64, _ string,
	add []*runnerv1.ResourceToDownload, removeTargetPaths []string,
) error {
	f.calls++
	f.add, f.removeTargetPaths = add, removeTargetPaths
	return f.err
}

func catalogRow(id int64, slug string) *skilldomain.Skill {
	orgID := testOrgID
	return &skilldomain.Skill{
		ID:             id,
		OrganizationID: &orgID,
		Slug:           slug,
		IsActive:       true,
		ContentSha:     strings.Repeat("a", 63) + string(rune('0'+id)),
		StorageKey:     "skills/" + slug + ".tar.gz",
		PackageSize:    1024,
		Version:        3,
	}
}

func specWithSkills(bindings ...specdomain.SkillPackageBinding) specdomain.Spec {
	ids := make([]int64, 0, len(bindings))
	for _, binding := range bindings {
		ids = append(ids, binding.SkillID)
	}
	gpuRequest := uint32(1)
	gpuLimit := uint32(2)
	return specdomain.NewV1(
		specdomain.Runtime{
			ModelBinding: specdomain.ModelBinding{
				ResourceID:         1001,
				ResourceRevision:   7,
				ConnectionID:       2001,
				ConnectionRevision: 9,
				ProviderKey:        slugkit.MustNewForTest("openai"),
				ProtocolAdapter:    slugkit.MustNewForTest("openai-compatible"),
				ModelID:            "gpt-5",
			},
			WorkerType: specdomain.WorkerType{
				Slug:           slugkit.MustNewForTest("claude-code"),
				DefinitionHash: strings.Repeat("b", 64),
			},
			Image: specdomain.RuntimeImage{
				ID:     41,
				Digest: "sha256:" + strings.Repeat("a", 64),
			},
		},
		specdomain.Placement{
			Policy: specdomain.PlacementPolicyAutomatic,
			ComputeTarget: specdomain.ComputeTarget{
				ID:   52,
				Kind: specdomain.ComputeTargetKindKubernetes,
			},
			DeploymentMode: specdomain.DeploymentModeDedicated,
			ResourceProfile: specdomain.ResourceProfile{
				ID: 63,
				Resources: specdomain.ResourceRequestsLimits{
					CPURequestMilliCPU: 500,
					CPULimitMilliCPU:   1000,
					MemoryRequestBytes: 536870912,
					MemoryLimitBytes:   1073741824,
					GPURequest:         &gpuRequest,
					GPULimit:           &gpuLimit,
				},
			},
		},
		specdomain.TypeConfig{
			SchemaVersion:   1,
			Values:          map[string]any{},
			SecretRefs:      map[string]specdomain.SecretReference{},
			InteractionMode: specdomain.InteractionModeACP,
			AutomationLevel: specdomain.AutomationLevelAutonomous,
		},
		specdomain.Workspace{SkillIDs: ids, SkillPackages: bindings},
		specdomain.Lifecycle{TerminationPolicy: specdomain.TerminationPolicyManual},
		specdomain.Metadata{},
	)
}

func bindingOf(row *skilldomain.Skill) specdomain.SkillPackageBinding {
	return specdomain.SkillPackageBinding{
		SkillID:     row.ID,
		Slug:        row.Slug,
		Version:     row.Version,
		ContentSHA:  row.ContentSha,
		StorageKey:  row.StorageKey,
		PackageSize: row.PackageSize,
	}
}

type harness struct {
	remounter *Remounter
	snapshots *fakeSnapshots
	pods      *fakePods
	commands  *fakeCommands
}

func newHarness(t *testing.T, mounted []*skilldomain.Skill, available ...*skilldomain.Skill) *harness {
	t.Helper()
	bindings := make([]specdomain.SkillPackageBinding, 0, len(mounted))
	for _, row := range mounted {
		bindings = append(bindings, bindingOf(row))
	}
	spec, err := specdomain.NormalizeAndValidate(specWithSkills(bindings...))
	require.NoError(t, err)

	catalog := fakeCatalog{}
	for _, row := range append(append([]*skilldomain.Skill{}, mounted...), available...) {
		catalog[row.ID] = row
	}
	snapshots := &fakeSnapshots{
		current: specdomain.Snapshot{ID: 100, OrganizationID: testOrgID, Spec: spec},
	}
	pods := &fakePods{}
	commands := &fakeCommands{}
	return &harness{
		remounter: NewRemounter(snapshots, pods, catalog, fakeSigner{}, commands),
		snapshots: snapshots,
		pods:      pods,
		commands:  commands,
	}
}

func (h *harness) remount(t *testing.T, live bool, skillIDs ...int64) (Result, error) {
	t.Helper()
	return h.remounter.Remount(context.Background(), Request{
		OrganizationID: testOrgID,
		PodKey:         "pod-1",
		RunnerID:       7,
		SnapshotID:     h.snapshots.current.ID,
		SkillIDs:       skillIDs,
		RunnerLive:     live,
	})
}

func TestRemountAddsSkillAndRepointsPodAtNewSnapshot(t *testing.T) {
	pdf := catalogRow(1, "pdf-tools")
	lint := catalogRow(2, "lint-guard")
	h := newHarness(t, []*skilldomain.Skill{pdf}, lint)

	result, err := h.remount(t, true, pdf.ID, lint.ID)
	require.NoError(t, err)

	assert.Equal(t, []string{"pdf-tools", "lint-guard"}, result.MountedSlugs)
	assert.Equal(t, []string{"lint-guard"}, result.AddedSlugs)
	assert.Empty(t, result.RemovedSlugs)
	assert.True(t, result.AppliedToRunner)

	// Snapshots stay append-only; the pod is repointed at the new one.
	require.Len(t, h.snapshots.created, 1)
	assert.Equal(t, podSnapshotColumn, h.pods.field)
	assert.Equal(t, result.SnapshotID, h.pods.value)
	assert.NotEqual(t, h.snapshots.current.ID, result.SnapshotID)

	require.Len(t, h.commands.add, 1)
	assert.Equal(t, lint.ContentSha, h.commands.add[0].GetSha())
	assert.Equal(t,
		"{{.sandbox.work_dir}}/.claude/skills/lint-guard",
		h.commands.add[0].GetTargetPath(),
	)
	assert.Empty(t, h.commands.removeTargetPaths)
}

func TestRemountUnmountsWithSandboxRelativeTargetPath(t *testing.T) {
	pdf := catalogRow(1, "pdf-tools")
	lint := catalogRow(2, "lint-guard")
	h := newHarness(t, []*skilldomain.Skill{pdf, lint})

	result, err := h.remount(t, true, pdf.ID)
	require.NoError(t, err)

	assert.Equal(t, []string{"lint-guard"}, result.RemovedSlugs)
	assert.Empty(t, result.AddedSlugs)
	assert.Empty(t, h.commands.add)
	assert.Equal(t,
		[]string{"{{.sandbox.work_dir}}/.claude/skills/lint-guard"},
		h.commands.removeTargetPaths,
	)
}

func TestRemountKeepsPinnedVersionAndShaFromCatalog(t *testing.T) {
	pdf := catalogRow(1, "pdf-tools")
	h := newHarness(t, nil, pdf)

	_, err := h.remount(t, false, pdf.ID)
	require.NoError(t, err)

	require.Len(t, h.snapshots.created, 1)
	packages := h.snapshots.created[0].Workspace.SkillPackages
	require.Len(t, packages, 1)
	assert.Equal(t, pdf.Version, packages[0].Version)
	assert.Equal(t, pdf.ContentSha, packages[0].ContentSHA)
	assert.Equal(t, pdf.StorageKey, packages[0].StorageKey)
	assert.Equal(t, []int64{pdf.ID}, h.snapshots.created[0].Workspace.SkillIDs)
}

func TestRemountWithoutChangeSkipsSnapshotAndRunner(t *testing.T) {
	pdf := catalogRow(1, "pdf-tools")
	h := newHarness(t, []*skilldomain.Skill{pdf})

	result, err := h.remount(t, true, pdf.ID)
	require.NoError(t, err)

	assert.Equal(t, h.snapshots.current.ID, result.SnapshotID)
	assert.Empty(t, h.snapshots.created)
	assert.Empty(t, h.pods.field)
	assert.Zero(t, h.commands.calls)
	assert.False(t, result.AppliedToRunner)
}

// A stopped worker must still record the change, otherwise the next start would
// silently resurrect the old mounts.
func TestRemountOnStoppedWorkerPersistsWithoutRunnerCall(t *testing.T) {
	pdf := catalogRow(1, "pdf-tools")
	h := newHarness(t, nil, pdf)

	result, err := h.remount(t, false, pdf.ID)
	require.NoError(t, err)

	assert.False(t, result.AppliedToRunner)
	assert.Zero(t, h.commands.calls)
	require.Len(t, h.snapshots.created, 1)
	assert.Equal(t, result.SnapshotID, h.pods.value)
}

func TestRemountRejectsSkillFromAnotherOrg(t *testing.T) {
	foreign := catalogRow(2, "lint-guard")
	otherOrg := testOrgID + 1
	foreign.OrganizationID = &otherOrg
	h := newHarness(t, nil, foreign)

	_, err := h.remount(t, true, foreign.ID)
	assert.ErrorIs(t, err, ErrInvalidSkillSelection)
	assert.Empty(t, h.snapshots.created)
}

func TestRemountRejectsInactiveSkill(t *testing.T) {
	stale := catalogRow(2, "lint-guard")
	stale.IsActive = false
	h := newHarness(t, nil, stale)

	_, err := h.remount(t, true, stale.ID)
	assert.ErrorIs(t, err, ErrInvalidSkillSelection)
}

func TestRemountRejectsSkillWithoutPackage(t *testing.T) {
	unpackaged := catalogRow(2, "lint-guard")
	unpackaged.StorageKey = ""
	h := newHarness(t, nil, unpackaged)

	_, err := h.remount(t, true, unpackaged.ID)
	assert.ErrorIs(t, err, ErrInvalidSkillSelection)
}

func TestRemountRejectsSkillIncompatibleWithWorkerType(t *testing.T) {
	codexOnly := catalogRow(2, "lint-guard")
	codexOnly.AgentFilter = []byte(`["codex-cli"]`)
	h := newHarness(t, nil, codexOnly)

	_, err := h.remount(t, true, codexOnly.ID)
	assert.ErrorIs(t, err, ErrInvalidSkillSelection)
}

func TestRemountRejectsDuplicateSelection(t *testing.T) {
	pdf := catalogRow(1, "pdf-tools")
	h := newHarness(t, nil, pdf)

	_, err := h.remount(t, true, pdf.ID, pdf.ID)
	assert.ErrorIs(t, err, ErrInvalidSkillSelection)
}

func TestRemountRejectsUnknownSkill(t *testing.T) {
	h := newHarness(t, nil)

	_, err := h.remount(t, true, 999)
	assert.ErrorIs(t, err, ErrInvalidSkillSelection)
}

func TestRemountRequiresSnapshot(t *testing.T) {
	h := newHarness(t, nil)

	_, err := h.remounter.Remount(context.Background(), Request{
		OrganizationID: testOrgID,
		PodKey:         "pod-1",
	})
	assert.ErrorIs(t, err, ErrSnapshotMissing)
}

// A dead gRPC stream must not lose the durable spec change; the caller is told
// the sandbox was not touched instead.
func TestRemountReportsNotAppliedWhenRunnerSendFails(t *testing.T) {
	pdf := catalogRow(1, "pdf-tools")
	h := newHarness(t, nil, pdf)
	h.commands.err = errors.New("runner not connected")

	result, err := h.remount(t, true, pdf.ID)
	require.NoError(t, err)

	assert.False(t, result.AppliedToRunner)
	require.Len(t, h.snapshots.created, 1)
	assert.Equal(t, result.SnapshotID, h.pods.value)
}

func TestRemountFailsWhenPodRepointFails(t *testing.T) {
	pdf := catalogRow(1, "pdf-tools")
	h := newHarness(t, nil, pdf)
	h.pods.err = errors.New("pod row vanished")

	_, err := h.remount(t, true, pdf.ID)
	require.Error(t, err)
	assert.Zero(t, h.commands.calls)
}
