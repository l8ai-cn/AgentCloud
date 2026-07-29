package workerspec_test

import (
	"testing"
	"time"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	"github.com/stretchr/testify/assert"
)

func TestIdleExhaustedOnlyAppliesToTheIdlePolicy(t *testing.T) {
	longIdle := 100 * time.Hour

	for _, policy := range []workerspec.TerminationPolicy{
		workerspec.TerminationPolicyManual,
		workerspec.TerminationPolicyOnCompleted,
	} {
		lifecycle := workerspec.Lifecycle{TerminationPolicy: policy}
		assert.False(t, lifecycle.IdleExhausted(longIdle), string(policy))
	}
}

func TestIdleExhaustedComparesAgainstTheSpecBudget(t *testing.T) {
	lifecycle := workerspec.Lifecycle{
		TerminationPolicy:  workerspec.TerminationPolicyOnIdle,
		IdleTimeoutMinutes: 30,
	}

	assert.False(t, lifecycle.IdleExhausted(29*time.Minute))
	assert.True(t, lifecycle.IdleExhausted(30*time.Minute))
	assert.True(t, lifecycle.IdleExhausted(31*time.Minute))
}

// A zero budget under the idle policy is rejected by spec validation, so
// reaching it means the spec was corrupted; expiring every worker instantly
// would be the most destructive possible reading of it.
func TestIdleExhaustedIgnoresAZeroBudget(t *testing.T) {
	lifecycle := workerspec.Lifecycle{TerminationPolicy: workerspec.TerminationPolicyOnIdle}

	assert.False(t, lifecycle.IdleExhausted(100*time.Hour))
}
