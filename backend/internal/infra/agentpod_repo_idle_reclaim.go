package infra

import (
	"context"
	"encoding/json"
	"time"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
)

type idleReclaimCandidate struct {
	PodKey       string          `gorm:"column:pod_key"`
	LastActivity time.Time       `gorm:"column:last_activity"`
	SpecJSON     json.RawMessage `gorm:"column:spec_json"`
}

// ListIdleExpiredPodKeys reports workers whose own pinned spec says to reclaim
// them after a stretch of inactivity. The budget is read from the spec snapshot
// rather than the pod row, so it cannot be widened or narrowed after launch.
//
// The comparison happens in Go rather than SQL because the two supported
// dialects express interval arithmetic differently, and the candidate set is
// bounded by the number of live workers.
func (r *podRepo) ListIdleExpiredPodKeys(ctx context.Context, now time.Time) ([]string, error) {
	var candidates []idleReclaimCandidate
	err := r.db.WithContext(ctx).Model(&agentpod.Pod{}).
		Select("pods.pod_key, pods.last_activity, worker_spec_snapshots.spec_json").
		Joins("JOIN worker_spec_snapshots ON worker_spec_snapshots.id = pods.worker_spec_snapshot_id").
		Where("pods.status IN ?", agentpod.ActiveStatuses()).
		Where("pods.last_activity IS NOT NULL").
		Scan(&candidates).Error
	if err != nil {
		return nil, err
	}

	expired := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		// Only the lifecycle is read, so a snapshot whose unrelated sections
		// no longer satisfy full-spec validation still gets reclaimed.
		var document struct {
			Lifecycle workerspec.Lifecycle `json:"lifecycle"`
		}
		if err := json.Unmarshal(candidate.SpecJSON, &document); err != nil {
			// An unreadable spec is not evidence that its worker is idle, and
			// terminating on a decode regression would destroy live workspaces.
			continue
		}
		if document.Lifecycle.IdleExhausted(now.Sub(candidate.LastActivity)) {
			expired = append(expired, candidate.PodKey)
		}
	}
	return expired, nil
}
