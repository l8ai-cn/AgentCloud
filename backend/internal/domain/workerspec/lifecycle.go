package workerspec

import "time"

type TerminationPolicy string

const (
	TerminationPolicyManual      TerminationPolicy = "manual"
	TerminationPolicyOnIdle      TerminationPolicy = "idle"
	TerminationPolicyOnCompleted TerminationPolicy = "completed"
)

type Lifecycle struct {
	TerminationPolicy  TerminationPolicy `json:"termination_policy"`
	IdleTimeoutMinutes uint32            `json:"idle_timeout_minutes"`
}

// IdleExhausted reports whether a worker unattended for idleFor has used up the
// budget its spec was pinned with. Only the idle policy expires: a manual
// worker is meant to outlive its operator's attention, and a completed worker
// ends on its own result rather than on a clock.
func (l Lifecycle) IdleExhausted(idleFor time.Duration) bool {
	if l.TerminationPolicy != TerminationPolicyOnIdle || l.IdleTimeoutMinutes == 0 {
		return false
	}
	return idleFor >= time.Duration(l.IdleTimeoutMinutes)*time.Minute
}
