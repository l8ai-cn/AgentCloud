package runner

import (
	"testing"
	"time"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
)

func TestACPTurnWatchdogStallsOnlyWithoutRunningTool(t *testing.T) {
	stalls := 0
	watchdog := newACPTurnWatchdog(func() { stalls++ })
	watchdog.stateChanged(acp.StateProcessing)

	watchdog.mu.Lock()
	watchdog.lastActivity = time.Now().Add(-acpTurnStallAfter - time.Second)
	watchdog.mu.Unlock()
	watchdog.check(time.Now())
	if stalls != 1 {
		t.Fatalf("stalls = %d, want 1", stalls)
	}

	watchdog = newACPTurnWatchdog(func() { stalls++ })
	watchdog.stateChanged(acp.StateProcessing)
	watchdog.toolUpdated(acp.ToolCallUpdate{ToolCallID: "ffmpeg", Status: "running"})
	watchdog.mu.Lock()
	watchdog.lastActivity = time.Now().Add(-acpTurnStallAfter - time.Second)
	watchdog.mu.Unlock()
	watchdog.check(time.Now())
	if stalls != 1 {
		t.Fatalf("running tool should suppress stall, got %d stalls", stalls)
	}
}
