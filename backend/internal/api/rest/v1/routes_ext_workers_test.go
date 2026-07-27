package v1

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func TestExtEmbedContextRouteRequiresSessionsEmbedScope(t *testing.T) {
	response := extEmbedContextResponse(t, []string{"pods:write", "experts:write"})

	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Contains(t, response.Body.String(), "INSUFFICIENT_SCOPE")
}

func TestExtEmbedContextRouteReachesHandlerWithScope(t *testing.T) {
	response := extEmbedContextResponse(t, []string{"sessions:embed"})

	assert.Equal(t, http.StatusCreated, response.Code, response.Body.String())
}

func TestExtEmbedContextRouteIsAbsentWithoutEmbedTokens(t *testing.T) {
	engine := gin.New()
	group := engine.Group("/ext")
	registerExtPodWorkerRoutes(group, &PodHandler{}, nil)

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(
		http.MethodPost, "/ext/workers/some-pod/embed-context", nil,
	))

	assert.Equal(t, http.StatusNotFound, recorder.Code)
}

func TestExtWorkerWorkspaceRoutesRequirePodsReadScope(t *testing.T) {
	for _, target := range []string{
		"/ext/workers/" + embedTestPodKey + "/workspace/files/wiki/pages/graph/course_graph.md",
		"/ext/workers/" + embedTestPodKey + "/workspace/search?include=wiki/pages/**/*.md",
	} {
		t.Run(target, func(t *testing.T) {
			denied := extWorkspaceResponse(t, []string{"sessions:embed"}, target)
			assert.Equal(t, http.StatusForbidden, denied.Code)
			assert.Contains(t, denied.Body.String(), "INSUFFICIENT_SCOPE")

			allowed := extWorkspaceResponse(t, []string{"pods:read"}, target)
			assert.Equal(t, http.StatusOK, allowed.Code, allowed.Body.String())
		})
	}
}

func extWorkspaceResponse(
	t *testing.T,
	scopes []string,
	target string,
) *httptest.ResponseRecorder {
	t.Helper()
	handler := &PodHandler{
		podService: &mockPodService{
			getPodFn: func(context.Context, string) (*agentpod.Pod, error) {
				return &agentpod.Pod{
					PodKey:         embedTestPodKey,
					RunnerID:       44,
					OrganizationID: embedTestOrgID,
					CreatedByID:    embedTestUserID,
				}, nil
			},
		},
		sandboxFs: &fakePodWorkspaceSandbox{
			connected: true,
			result:    &runnerv1.SandboxFsResultEvent{WorkspaceRoot: "/workspace"},
		},
	}
	return extWorkerRouteResponse(t, scopes, handler, http.MethodGet, target, nil)
}

func extEmbedContextResponse(
	t *testing.T,
	scopes []string,
) *httptest.ResponseRecorder {
	t.Helper()
	return extWorkerRouteResponse(
		t,
		scopes,
		&PodHandler{},
		http.MethodPost,
		"/ext/workers/"+embedTestPodKey+"/embed-context",
		bytes.NewBufferString(
			`{"parent_origins":["https://zhiyong.example"],"capabilities":["read"]}`,
		),
	)
}

func extWorkerRouteResponse(
	t *testing.T,
	scopes []string,
	podHandler *PodHandler,
	method string,
	target string,
	body io.Reader,
) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	group := engine.Group("/ext")
	group.Use(func(c *gin.Context) {
		c.Set("apikey_context", &middleware.APIKeyContext{
			APIKeyID: 1, KeyName: "zhiyong", Scopes: scopes,
		})
		c.Set("tenant", &middleware.TenantContext{
			OrganizationID:   embedTestOrgID,
			OrganizationSlug: "acme",
			UserID:           embedTestUserID,
			UserRole:         "apikey",
		})
	})
	registerExtPodWorkerRoutes(group, podHandler, workerEmbedHandler(t))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, target, body)
	request.Header.Set("Content-Type", "application/json")
	engine.ServeHTTP(recorder, request)
	require.NotNil(t, recorder)
	return recorder
}
