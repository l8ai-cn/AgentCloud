package imbridge

import (
	"context"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
)

type PodLister interface {
	ListPods(ctx context.Context, orgID int64, q agentpod.PodListQuery) ([]*agentpod.Pod, int64, error)
}

type podCatalogAdapter struct {
	pods PodLister
}

func NewPodCatalogAdapter(pods PodLister) PodCatalog {
	return &podCatalogAdapter{pods: pods}
}

func (a *podCatalogAdapter) ListOnlinePodKeys(ctx context.Context, orgID int64) ([]string, error) {
	if a == nil || a.pods == nil {
		return nil, nil
	}
	rows, _, err := a.pods.ListPods(ctx, orgID, agentpod.PodListQuery{
		Statuses: []string{agentpod.StatusRunning, agentpod.StatusInitializing},
		Limit:    100,
	})
	if err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(rows))
	for _, row := range rows {
		if row != nil && row.PodKey != "" {
			keys = append(keys, row.PodKey)
		}
	}
	return keys, nil
}
