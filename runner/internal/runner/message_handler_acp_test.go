package runner

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/runner/internal/client"
	"github.com/l8ai-cn/agentcloud/runner/internal/config"
)

// acpMockPodIO is a minimal PodIO for testing ACP-related code paths.
type acpMockPodIO struct {
	sendInputCalled     bool
	sendInputText       string
	respondPermCalled   bool
	respondPermReqID    string
	respondPermApproved bool
	cancelSessionCalled bool
	stopCalled          bool
}

func (m *acpMockPodIO) Mode() string                              { return "acp" }
func (m *acpMockPodIO) GetSnapshot(int) (string, error)           { return "", nil }
func (m *acpMockPodIO) GetAgentStatus() string                    { return "idle" }
func (m *acpMockPodIO) SubscribeStateChange(string, func(string)) {}
func (m *acpMockPodIO) UnsubscribeStateChange(string)             {}
func (m *acpMockPodIO) SendKeys([]string) error                   { return nil }
func (m *acpMockPodIO) Resize(int, int) (bool, error)             { return false, nil }
func (m *acpMockPodIO) GetPID() int                               { return 0 }
func (m *acpMockPodIO) CursorPosition() (int, int)                { return 0, 0 }
func (m *acpMockPodIO) GetScreenSnapshot() string                 { return "" }
func (m *acpMockPodIO) Stop()                                     { m.stopCalled = true }
func (m *acpMockPodIO) Teardown() string                          { return "" }
func (m *acpMockPodIO) SetExitHandler(func(int))                  {}
func (m *acpMockPodIO) Start() error                              { return nil }
func (m *acpMockPodIO) SetIOErrorHandler(func(error))             {}
func (m *acpMockPodIO) Redraw() error                             { return nil }
func (m *acpMockPodIO) Detach()                                   {}
func (m *acpMockPodIO) WriteOutput([]byte)                        {}

func (m *acpMockPodIO) SendInput(text string) error {
	m.sendInputCalled = true
	m.sendInputText = text
	return nil
}

func (m *acpMockPodIO) RespondToPermission(reqID string, approved bool) error {
	m.respondPermCalled = true
	m.respondPermReqID = reqID
	m.respondPermApproved = approved
	return nil
}

func (m *acpMockPodIO) CancelSession() error {
	m.cancelSessionCalled = true
	return nil
}

func TestHandleACPExit_CleanupPodExit(t *testing.T) {
	store := NewInMemoryPodStore()
	mockConn := client.NewMockConnection()
	handler := NewRunnerMessageHandler(&Runner{cfg: &config.Config{}}, store, mockConn)

	pod := &Pod{PodKey: "acp-exit-1", Status: PodStatusRunning}
	store.Put("acp-exit-1", pod)

	handler.handleACPExit("acp-exit-1", 0)

	if _, ok := store.Get("acp-exit-1"); ok {
		t.Error("pod should be removed after exit")
	}
}

func TestAbortACPPodStartup_RemovesPodFromStore(t *testing.T) {
	store := NewInMemoryPodStore()
	handler := NewRunnerMessageHandler(&Runner{cfg: &config.Config{}}, store, client.NewMockConnection())
	store.Put("acp-fail", &Pod{PodKey: "acp-fail"})

	if err := handler.abortACPPodStartup("acp-fail", nil, ""); err != nil {
		t.Fatalf("abortACPPodStartup failed: %v", err)
	}

	if _, ok := store.Get("acp-fail"); ok {
		t.Error("pod should be removed after failed ACP startup")
	}
}

func TestFailACPPodStopsIOAndReportsTerminalError(t *testing.T) {
	store := NewInMemoryPodStore()
	conn := client.NewMockConnection()
	handler := NewRunnerMessageHandler(&Runner{cfg: &config.Config{}}, store, conn)
	io := &acpMockPodIO{}
	pod := &Pod{
		PodKey:          "acp-stalled-1",
		InteractionMode: InteractionModeACP,
		IO:              io,
	}
	store.Put(pod.PodKey, pod)

	handler.failACPPod(pod.PodKey, pod, client.ErrCodeACPTurnStalled, "no progress")

	if !io.stopCalled {
		t.Fatal("ACP I/O should be stopped")
	}
	if _, ok := store.Get(pod.PodKey); ok {
		t.Fatal("failed ACP pod should be removed from the store")
	}
	if len(conn.Events) != 2 {
		t.Fatalf("events = %d, want error and termination", len(conn.Events))
	}
	errorEvent, ok := conn.Events[0].Data.(map[string]interface{})
	if !ok || errorEvent["code"] != client.ErrCodeACPTurnStalled {
		t.Fatalf("first event = %#v, want terminal ACP error", conn.Events[0])
	}
}
