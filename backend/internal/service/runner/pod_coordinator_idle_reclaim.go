package runner

import (
	"context"
	"errors"
	"time"
)

// ReclaimIdleWorkers terminates workers that have outlived the idle budget in
// their own spec. This is Agent Cloud's own resource reclaim, modelled on
// Zhiyong's heartbeat-idle stop: activity baseline plus a declared timeout,
// then a real terminate. It does not depend on any caller to free compute.
// The stale-pod sweep only records that a worker went quiet; this one frees it.
func (pc *PodCoordinator) ReclaimIdleWorkers(ctx context.Context) (int, error) {
	keys, err := pc.podStore.ListIdleExpiredPodKeys(ctx, time.Now())
	if err != nil {
		return 0, err
	}

	reclaimed := 0
	for _, podKey := range keys {
		// One unreachable runner must not strand the rest of the batch, and a
		// worker that already ended is a success for our purposes.
		if err := pc.TerminatePod(ctx, podKey); err != nil {
			if errors.Is(err, ErrPodAlreadyTerminated) {
				continue
			}
			pc.logger.Error("failed to reclaim idle worker", "pod_key", podKey, "error", err)
			continue
		}
		reclaimed++
		pc.logger.Info("reclaimed idle worker", "pod_key", podKey)
	}
	return reclaimed, nil
}
