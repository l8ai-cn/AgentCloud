package runner

import (
	"sync"
	"time"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
)

var (
	acpTurnStallAfter = 10 * time.Minute
	acpTurnWatchEvery = time.Minute
)

type acpTurnWatchdog struct {
	mu           sync.Mutex
	state        string
	lastActivity time.Time
	runningTools map[string]struct{}
	stalled      bool
	stop         chan struct{}
	onStall      func()
}

func newACPTurnWatchdog(onStall func()) *acpTurnWatchdog {
	return &acpTurnWatchdog{
		runningTools: make(map[string]struct{}),
		stop:         make(chan struct{}),
		onStall:      onStall,
	}
}

func (w *acpTurnWatchdog) start() {
	go func() {
		ticker := time.NewTicker(acpTurnWatchEvery)
		defer ticker.Stop()
		for {
			select {
			case now := <-ticker.C:
				w.check(now)
			case <-w.stop:
				return
			}
		}
	}()
}

func (w *acpTurnWatchdog) stopWatching() {
	select {
	case <-w.stop:
	default:
		close(w.stop)
	}
}

func (w *acpTurnWatchdog) stateChanged(state string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.state = state
	if state == acp.StateProcessing {
		w.lastActivity = time.Now()
		w.stalled = false
		return
	}
	w.runningTools = make(map[string]struct{})
}

func (w *acpTurnWatchdog) touched() {
	w.mu.Lock()
	w.lastActivity = time.Now()
	w.mu.Unlock()
}

func (w *acpTurnWatchdog) toolUpdated(update acp.ToolCallUpdate) {
	w.touched()
	if update.ToolCallID == "" {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	switch update.Status {
	case "pending", "running", "in_progress":
		w.runningTools[update.ToolCallID] = struct{}{}
	case "completed", "failed", "cancelled":
		delete(w.runningTools, update.ToolCallID)
	}
}

func (w *acpTurnWatchdog) check(now time.Time) {
	w.mu.Lock()
	if w.stalled || w.state != acp.StateProcessing || len(w.runningTools) > 0 ||
		now.Sub(w.lastActivity) < acpTurnStallAfter {
		w.mu.Unlock()
		return
	}
	w.stalled = true
	w.mu.Unlock()
	w.onStall()
}
