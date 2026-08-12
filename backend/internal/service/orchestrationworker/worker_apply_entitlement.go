package orchestrationworker

import (
	"context"

	control "github.com/l8ai-cn/agentcloud/backend/internal/domain/orchestrationcontrol"
	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
)

type WorkerSpecSnapshotLoader interface {
	GetByID(
		context.Context,
		int64,
		int64,
	) (specdomain.Snapshot, error)
}

type WorkerTypeSnapshotValidator interface {
	ValidateWorkerTypeSnapshot(
		context.Context,
		specservice.Scope,
		specdomain.WorkerType,
	) error
}

func (service *WorkerApplyService) SetWorkerTypeSnapshotValidator(
	validator WorkerTypeSnapshotValidator,
) {
	if service == nil {
		return
	}
	service.workerTypeValidator = validator
}

func (service *WorkerApplyService) SetWorkerSpecSnapshotLoader(
	loader WorkerSpecSnapshotLoader,
) {
	if service == nil {
		return
	}
	service.snapshotLoader = loader
}

func (service *WorkerApplyService) ensureWorkerTypeEntitled(
	ctx context.Context,
	scope control.Scope,
	snapshotID int64,
) error {
	if service == nil || snapshotID <= 0 ||
		service.workerTypeValidator == nil || service.snapshotLoader == nil {
		return nil
	}
	snapshot, err := service.snapshotLoader.GetByID(
		ctx,
		scope.OrganizationID,
		snapshotID,
	)
	if err != nil {
		return err
	}
	return service.workerTypeValidator.ValidateWorkerTypeSnapshot(
		ctx,
		specservice.Scope{
			OrgID:   scope.OrganizationID,
			OrgSlug: scope.OrganizationSlug,
			UserID:  scope.ActorID,
		},
		snapshot.Spec.Runtime.WorkerType,
	)
}
