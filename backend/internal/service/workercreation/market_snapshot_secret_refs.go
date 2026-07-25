package workercreation

import (
	"context"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

func (service *Service) marketSnapshotSecretRefs(
	ctx context.Context,
	scope specservice.Scope,
	workerType slugkit.Slug,
) (map[string]specdomain.SecretReference, error) {
	resolution, err := service.workerTypes.ResolveWorkerType(ctx, scope, workerType)
	if err != nil {
		return nil, err
	}
	if resolution.WorkerType.Slug != workerType {
		return nil, invalidMarketSnapshotDraft(
			"worker_type_slug",
			"worker type resolver substituted the requested slug",
		)
	}
	return service.freshPodSecretRefs(
		ctx,
		scope,
		workerType,
		resolution.TypeSchema,
	)
}

func marketTypeConfigWithSecretRefs(
	config specdomain.TypeConfig,
	refs map[string]specdomain.SecretReference,
) specdomain.TypeConfig {
	config.SecretRefs = refs
	if config.SecretRefs == nil {
		config.SecretRefs = map[string]specdomain.SecretReference{}
	}
	return config
}
