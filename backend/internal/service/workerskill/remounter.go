package workerskill

import (
	"context"
	"fmt"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	agentservice "github.com/l8ai-cn/agentcloud/backend/internal/service/agent"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

const podSnapshotColumn = "worker_spec_snapshot_id"

type Remounter struct {
	snapshots SnapshotStore
	pods      PodSnapshotBinder
	catalog   SkillCatalog
	signer    PackageSigner
	commands  CommandSender
}

func NewRemounter(
	snapshots SnapshotStore,
	pods PodSnapshotBinder,
	catalog SkillCatalog,
	signer PackageSigner,
	commands CommandSender,
) *Remounter {
	return &Remounter{
		snapshots: snapshots,
		pods:      pods,
		catalog:   catalog,
		signer:    signer,
		commands:  commands,
	}
}

// Remount re-pins the requested skills, records them in a fresh spec snapshot and
// repoints the worker at it. Snapshots stay append-only so an audit of what a
// worker ran at any point in time remains reconstructible.
func (r *Remounter) Remount(ctx context.Context, req Request) (Result, error) {
	if r == nil || r.snapshots == nil || r.pods == nil || r.catalog == nil {
		return Result{}, ErrDependencyUnavailable
	}
	if req.SnapshotID <= 0 {
		return Result{}, ErrSnapshotMissing
	}
	current, err := r.snapshots.GetByID(ctx, req.OrganizationID, req.SnapshotID)
	if err != nil {
		return Result{}, err
	}
	workerType := current.Spec.Runtime.WorkerType.Slug.String()

	desired, err := r.pinSkills(ctx, req.OrganizationID, workerType, req.SkillIDs)
	if err != nil {
		return Result{}, err
	}

	change := diffMounts(current.Spec.Workspace.SkillPackages, desired)
	if len(change.added) == 0 && len(change.removed) == 0 {
		return Result{
			SnapshotID:   current.ID,
			MountedSlugs: slugsOf(desired),
		}, nil
	}

	snapshotID, err := r.persistRemount(ctx, req.OrganizationID, current.Spec, desired)
	if err != nil {
		return Result{}, err
	}
	if err := r.pods.UpdateField(ctx, req.PodKey, podSnapshotColumn, snapshotID); err != nil {
		return Result{}, err
	}

	result := Result{
		SnapshotID:   snapshotID,
		MountedSlugs: slugsOf(desired),
		AddedSlugs:   slugsOf(change.added),
		RemovedSlugs: change.removed,
	}
	result.AppliedToRunner, err = r.applyToSandbox(ctx, req, workerType, change)
	if err != nil {
		return Result{}, err
	}
	return result, nil
}

func (r *Remounter) persistRemount(
	ctx context.Context,
	organizationID int64,
	spec specdomain.Spec,
	desired []specdomain.SkillPackageBinding,
) (int64, error) {
	next := spec
	next.Workspace.SkillIDs = make([]int64, 0, len(desired))
	for _, binding := range desired {
		next.Workspace.SkillIDs = append(next.Workspace.SkillIDs, binding.SkillID)
	}
	next.Workspace.SkillPackages = append([]specdomain.SkillPackageBinding{}, desired...)

	resolved, err := specservice.NewResolvedSnapshot(organizationID, next)
	if err != nil {
		return 0, fmt.Errorf("%w: %v", ErrInvalidSkillSelection, err)
	}
	snapshot, err := r.snapshots.Create(ctx, resolved)
	if err != nil {
		return 0, err
	}
	return snapshot.ID, nil
}

func (r *Remounter) applyToSandbox(
	ctx context.Context,
	req Request,
	workerType string,
	change delta,
) (bool, error) {
	if !req.RunnerLive || r.commands == nil || r.signer == nil {
		return false, nil
	}
	add, err := r.signedResources(ctx, workerType, change.added)
	if err != nil {
		return false, err
	}
	removePaths := make([]string, 0, len(change.removed))
	for _, slug := range change.removed {
		removePaths = append(removePaths, agentservice.SkillTargetPath(workerType, slug))
	}
	if err := r.commands.SendUpdatePodSkills(
		ctx, req.RunnerID, req.PodKey, add, removePaths,
	); err != nil {
		return false, nil
	}
	return true, nil
}

func (r *Remounter) signedResources(
	ctx context.Context,
	workerType string,
	added []specdomain.SkillPackageBinding,
) ([]*runnerv1.ResourceToDownload, error) {
	if len(added) == 0 {
		return nil, nil
	}
	skills, err := r.signer.GetWorkerSkillsByPackages(ctx, added, workerType)
	if err != nil {
		return nil, fmt.Errorf("sign remounted worker skills: %w", err)
	}
	resources := make([]*runnerv1.ResourceToDownload, 0, len(skills))
	for _, resolved := range skills {
		if resolved == nil || resolved.ContentSha == "" || resolved.DownloadURL == "" {
			return nil, fmt.Errorf("remounted worker skill has incomplete download metadata")
		}
		resources = append(resources, &runnerv1.ResourceToDownload{
			Sha:          resolved.ContentSha,
			DownloadUrl:  resolved.DownloadURL,
			TargetPath:   agentservice.SkillTargetPath(workerType, resolved.Slug),
			ResourceType: "skill_package",
			SizeBytes:    resolved.PackageSize,
		})
	}
	return resources, nil
}
