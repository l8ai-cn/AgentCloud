package workerskill

import (
	"context"
	"errors"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	extensionservice "github.com/l8ai-cn/agentcloud/backend/internal/service/extension"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

var (
	ErrDependencyUnavailable = errors.New("worker skill remounter is unavailable")
	ErrSnapshotMissing       = errors.New("worker has no spec snapshot to remount")
	ErrInvalidSkillSelection  = errors.New("invalid skill selection")
)

type SkillCatalog interface {
	GetAnyByID(ctx context.Context, id int64) (*skill.Skill, error)
}

// PackageSigner mints short-lived download URLs for already pinned packages, so
// the remount ships the exact bytes recorded in the snapshot.
type PackageSigner interface {
	GetWorkerSkillsByPackages(
		ctx context.Context,
		packages []specdomain.SkillPackageBinding,
		agentSlug string,
	) ([]*extensionservice.ResolvedSkill, error)
}

type SnapshotStore interface {
	GetByID(ctx context.Context, organizationID, snapshotID int64) (specdomain.Snapshot, error)
	Create(ctx context.Context, resolved specservice.ResolvedSnapshot) (specdomain.Snapshot, error)
}

type PodSnapshotBinder interface {
	UpdateField(ctx context.Context, podKey, field string, value interface{}) error
}

type CommandSender interface {
	SendUpdatePodSkills(
		ctx context.Context,
		runnerID int64,
		podKey string,
		add []*runnerv1.ResourceToDownload,
		removeSlugs []string,
	) error
}

type Request struct {
	OrganizationID int64
	PodKey         string
	RunnerID       int64
	SnapshotID     int64
	SkillIDs       []int64
	// RunnerLive gates the sandbox write; a stopped worker only gets the new
	// snapshot and materializes it on its next start.
	RunnerLive bool
}

type Result struct {
	SnapshotID      int64
	MountedSlugs    []string
	AddedSlugs      []string
	RemovedSlugs    []string
	AppliedToRunner bool
}
