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
	LastActivity *time.Time      `gorm:"column:last_activity"`
	StartedAt    *time.Time      `gorm:"column:started_at"`
	CreatedAt    time.Time       `gorm:"column:created_at"`
	SpecJSON     json.RawMessage `gorm:"column:spec_json"`
}

// lastAttended mirrors Zhiyong's idle reclaim activity baseline: prefer the
// latest heartbeat/activity, otherwise the moment the worker became live, then
// the create timestamp. A worker with none of those is left alone rather than
// treated as idle from the epoch.
func (c idleReclaimCandidate) lastAttended() (time.Time, bool) {
	if c.LastActivity != nil && !c.LastActivity.IsZero() {
		return *c.LastActivity, true
	}
	if c.StartedAt != nil && !c.StartedAt.IsZero() {
		return *c.StartedAt, true
	}
	if !c.CreatedAt.IsZero() {
		return c.CreatedAt, true
	}
	return time.Time{}, false
}

// ListIdleExpiredPodKeys reports workers whose own pinned spec says to reclaim
// them after a stretch of inactivity. The budget is read from the worker's
// lifecycle, not from any caller: Agent Cloud owns worker reclaim the same way
// Zhiyong owns experiment reclaim, and neither waits on the other.
//
// The comparison happens in Go rather than SQL because the two supported
// dialects express interval arithmetic differently, and the candidate set is
// bounded by the number of live workers.
func (r *podRepo) ListIdleExpiredPodKeys(ctx context.Context, now time.Time) ([]string, error) {
	var candidates []idleReclaimCandidate
	err := r.db.WithContext(ctx).Model(&agentpod.Pod{}).
		Select("pods.pod_key, pods.last_activity, pods.started_at, pods.created_at, worker_spec_snapshots.spec_json").
		Joins("JOIN worker_spec_snapshots ON worker_spec_snapshots.id = pods.worker_spec_snapshot_id").
		Where("pods.status IN ?", agentpod.ActiveStatuses()).
		Scan(&candidates).Error
	if err != nil {
		return nil, err
	}

	expired := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		attended, ok := candidate.lastAttended()
		if !ok {
			continue
		}
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
		if document.Lifecycle.IdleExhausted(now.Sub(attended)) {
			expired = append(expired, candidate.PodKey)
		}
	}
	return expired, nil
}
