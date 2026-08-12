package runner

import "github.com/l8ai-cn/agentcloud/runner/internal/client"

func (h *RunnerMessageHandler) failACPPod(podKey string, pod *Pod, code, message string) {
	pod.acpFailureOnce.Do(func() {
		h.sendPodErrorWithCode(podKey, client.NewPodError(code, message))
		h.cleanupPodExit(podKey, 1, true)
	})
}
