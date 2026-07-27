package v1

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/pkg/workerinterface"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func TestExtWorkerInterfaceProxyForwardsLiveResponse(t *testing.T) {
	sandbox := interfaceProxySandbox(t, http.StatusOK, `{"service":"learning-companion"}`)
	handler := interfaceProxyHandler(t, agentpod.StatusRunning, sandbox)
	response := extWorkerRouteResponse(
		t,
		[]string{"pods:read"},
		handler,
		http.MethodGet,
		"/ext/workers/"+embedTestPodKey+"/interfaces/learning-companion/health",
		nil,
	)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.JSONEq(t, `{"service":"learning-companion"}`, response.Body.String())
	assert.Equal(t, "http_proxy", sandbox.command.GetOp())
	assert.Equal(t, "learning-companion", sandbox.command.GetPath())
}

func TestExtWorkerInterfaceProxyRejectsInactivePod(t *testing.T) {
	handler := interfaceProxyHandler(t, agentpod.StatusCompleted, &fakePodWorkspaceSandbox{connected: true})
	response := extWorkerRouteResponse(
		t,
		[]string{"pods:read"},
		handler,
		http.MethodGet,
		"/ext/workers/"+embedTestPodKey+"/interfaces/learning-companion/workspace",
		nil,
	)
	assert.Equal(t, http.StatusConflict, response.Code)
}

func TestExtWorkerInterfaceProxyRequiresPodsReadScope(t *testing.T) {
	handler := interfaceProxyHandler(t, agentpod.StatusRunning, &fakePodWorkspaceSandbox{connected: true})
	response := extWorkerRouteResponse(
		t,
		[]string{"sessions:embed"},
		handler,
		http.MethodGet,
		"/ext/workers/"+embedTestPodKey+"/interfaces/learning-companion/workspace",
		nil,
	)
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Contains(t, response.Body.String(), "INSUFFICIENT_SCOPE")
}

func TestExtWorkerInterfaceProxyWriteMethodsRequirePodsWriteScope(t *testing.T) {
	for _, method := range interfaceWriteMethods {
		t.Run(method, func(t *testing.T) {
			handler := interfaceProxyHandler(
				t,
				agentpod.StatusRunning,
				&fakePodWorkspaceSandbox{connected: true},
			)
			response := extWorkerRouteResponse(
				t,
				[]string{"pods:read"},
				handler,
				method,
				"/ext/workers/"+embedTestPodKey+"/interfaces/learning-companion/practice/submit",
				strings.NewReader(`{}`),
			)
			assert.Equal(t, http.StatusForbidden, response.Code, response.Body.String())
			assert.Contains(t, response.Body.String(), "INSUFFICIENT_SCOPE")
		})
	}
}

func TestExtWorkerInterfaceProxyAllowsWriteWithPodsWriteScope(t *testing.T) {
	sandbox := interfaceProxySandbox(t, http.StatusOK, `{"code":0}`)
	handler := interfaceProxyHandler(t, agentpod.StatusRunning, sandbox)
	response := extWorkerRouteResponse(
		t,
		[]string{"pods:write"},
		handler,
		http.MethodPost,
		"/ext/workers/"+embedTestPodKey+"/interfaces/learning-companion/practice/submit",
		strings.NewReader(`{"answer":"a"}`),
	)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Equal(t, "http_proxy", sandbox.command.GetOp())
}

func TestValidateWorkerInterfacePathRejectsTraversal(t *testing.T) {
	require.Error(t, workerinterface.ValidatePath("/../etc/passwd"))
	require.NoError(t, workerinterface.ValidatePath("/workspace"))
}

func interfaceProxySandbox(t *testing.T, status int, body string) *fakePodWorkspaceSandbox {
	t.Helper()
	encoded, err := json.Marshal(workerinterface.Response{
		Status:  status,
		Headers: map[string][]string{"Content-Type": {"application/json"}},
		BodyB64: base64.StdEncoding.EncodeToString([]byte(body)),
	})
	require.NoError(t, err)
	return &fakePodWorkspaceSandbox{
		connected: true,
		result: &runnerv1.SandboxFsResultEvent{
			Content:  string(encoded),
			Encoding: workerinterface.ResponseEncoding,
		},
	}
}

func interfaceProxyHandler(
	t *testing.T,
	status string,
	sandbox *fakePodWorkspaceSandbox,
) *PodHandler {
	t.Helper()
	return &PodHandler{
		podService: &mockPodService{
			getPodFn: func(context.Context, string) (*agentpod.Pod, error) {
				return &agentpod.Pod{
					PodKey:         embedTestPodKey,
					RunnerID:       44,
					OrganizationID: embedTestOrgID,
					CreatedByID:    embedTestUserID,
					Status:         status,
				}, nil
			},
		},
		sandboxFs: sandbox,
	}
}
