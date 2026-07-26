package imbridge

import (
	"context"
	"time"
)

const egressMaxAttempts = 3

// withRetry retries transient upstream failures only. A 4xx will not become a
// 2xx on the next attempt, and sends are not idempotent, so repeating them just
// risks duplicate IM messages.
func withRetry(ctx context.Context, fn func() error) error {
	var last error
	for attempt := 0; attempt < egressMaxAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Duration(40<<attempt) * time.Millisecond):
			}
		}
		err := fn()
		if err == nil {
			return nil
		}
		last = err
		if isPermanentError(err) || ctx.Err() != nil {
			return err
		}
	}
	return last
}
