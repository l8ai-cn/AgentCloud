package sessionapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	podDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/internal/infra"
	agentpodservice "github.com/l8ai-cn/agentcloud/backend/internal/service/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/pkg/workerinterface"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func TestEmbedInterfaceProxyForwardsSkillResponse(t *testing.T) {
	deps, sandbox := interfaceProxyEmbedDeps(t, http.StatusOK, `{"service":"learning-companion"}`)
	router := gin.New()
	registerEmbedRoutes(router.Group("/v1"), *deps)

	response := embedSessionRequest(
		router,
		http.MethodGet,
		"/v1/embed/sessions/conv_embed/interfaces/learning-companion/graph/layers?student_id=s1",
		embedSessionToken(t, deps, []string{"read"}),
	)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.JSONEq(t, `{"service":"learning-companion"}`, response.Body.String())
	assert.Equal(t, "http_proxy", sandbox.command.GetOp())
	assert.Equal(t, "learning-companion", sandbox.command.GetPath())
	assert.Equal(t, "embed-pod", sandbox.command.GetPodKey())

	var payload struct {
		Method string `json:"method"`
		Path   string `json:"path"`
		Query  string `json:"query"`
	}
	require.NoError(t, json.Unmarshal([]byte(sandbox.command.GetPayload()), &payload))
	assert.Equal(t, http.MethodGet, payload.Method)
	assert.Equal(t, "/graph/layers", payload.Path)
	assert.Equal(t, "student_id=s1", payload.Query)
}

func TestEmbedInterfaceProxyWriteRequiresWriteCapability(t *testing.T) {
	deps, _ := interfaceProxyEmbedDeps(t, http.StatusOK, `{"code":0}`)
	router := gin.New()
	registerEmbedRoutes(router.Group("/v1"), *deps)

	denied := embedInterfaceWriteRequest(
		router,
		embedSessionToken(t, deps, []string{"read"}),
	)
	assert.Equal(t, http.StatusForbidden, denied.Code, denied.Body.String())

	allowed := embedInterfaceWriteRequest(
		router,
		embedSessionToken(t, deps, []string{"read", "write"}),
	)
	assert.Equal(t, http.StatusOK, allowed.Code, allowed.Body.String())
}

func TestEmbedInterfaceProxyRejectsForeignSession(t *testing.T) {
	deps, _, db := interfaceProxyEmbedDepsWithDB(t, podDomain.StatusRunning, http.StatusOK, `{}`)
	insertSessionByPodTestRow(t, db, "conv_other", "other-pod", 21, 11)
	router := gin.New()
	registerEmbedRoutes(router.Group("/v1"), *deps)

	response := embedSessionRequest(
		router,
		http.MethodGet,
		"/v1/embed/sessions/conv_other/interfaces/learning-companion/workspace",
		embedSessionToken(t, deps, []string{"read"}),
	)

	assert.Equal(t, http.StatusNotFound, response.Code, response.Body.String())
}

func TestEmbedInterfaceProxyRejectsTraversalPath(t *testing.T) {
	deps, _ := interfaceProxyEmbedDeps(t, http.StatusOK, `{}`)
	router := gin.New()
	registerEmbedRoutes(router.Group("/v1"), *deps)

	response := embedSessionRequest(
		router,
		http.MethodGet,
		"/v1/embed/sessions/conv_embed/interfaces/learning-companion/../../etc/passwd",
		embedSessionToken(t, deps, []string{"read"}),
	)

	assert.NotEqual(t, http.StatusOK, response.Code)
}

func TestEmbedInterfaceProxyReportsMissingSocketAsUnavailable(t *testing.T) {
	deps, _ := interfaceProxyEmbedDeps(t, http.StatusOK, `{}`)
	deps.SandboxFs = &interfaceProxySandboxStub{
		connected: true,
		result:    &runnerv1.SandboxFsResultEvent{Error: "interface socket not found"},
	}
	router := gin.New()
	registerEmbedRoutes(router.Group("/v1"), *deps)

	response := embedSessionRequest(
		router,
		http.MethodGet,
		"/v1/embed/sessions/conv_embed/interfaces/learning-companion/health",
		embedSessionToken(t, deps, []string{"read"}),
	)

	assert.Equal(t, http.StatusServiceUnavailable, response.Code, response.Body.String())
}

func TestEmbedInterfaceProxyRejectsInactiveWorker(t *testing.T) {
	deps, _, _ := interfaceProxyEmbedDepsWithDB(
		t,
		podDomain.StatusCompleted,
		http.StatusOK,
		`{}`,
	)
	router := gin.New()
	registerEmbedRoutes(router.Group("/v1"), *deps)

	response := embedSessionRequest(
		router,
		http.MethodGet,
		"/v1/embed/sessions/conv_embed/interfaces/learning-companion/health",
		embedSessionToken(t, deps, []string{"read"}),
	)

	assert.Equal(t, http.StatusConflict, response.Code, response.Body.String())
}

func TestEmbedInterfaceListReturnsReadyInterfaces(t *testing.T) {
	deps, _ := interfaceProxyEmbedDeps(t, http.StatusOK, `{}`)
	deps.SandboxFs = &interfaceProxySandboxStub{
		connected: true,
		result: &runnerv1.SandboxFsResultEvent{
			Entries: []*runnerv1.SandboxFsEntry{{Path: "learning-companion"}},
		},
	}
	router := gin.New()
	registerEmbedRoutes(router.Group("/v1"), *deps)

	response := embedSessionRequest(
		router,
		http.MethodGet,
		"/v1/embed/sessions/conv_embed/interfaces",
		embedSessionToken(t, deps, []string{"read"}),
	)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.JSONEq(
		t,
		`{"interfaces":[{"id":"learning-companion","ready":true}]}`,
		response.Body.String(),
	)
}

func embedInterfaceWriteRequest(router *gin.Engine, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/embed/sessions/conv_embed/interfaces/learning-companion/practice/submit",
		strings.NewReader(`{"answer":"a"}`),
	)
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func interfaceProxyEmbedDeps(
	t *testing.T,
	status int,
	body string,
) (*Deps, *interfaceProxySandboxStub) {
	t.Helper()
	deps, sandbox, _ := interfaceProxyEmbedDepsWithDB(
		t,
		podDomain.StatusRunning,
		status,
		body,
	)
	return deps, sandbox
}

func interfaceProxyEmbedDepsWithDB(
	t *testing.T,
	podStatus string,
	status int,
	body string,
) (*Deps, *interfaceProxySandboxStub, *gorm.DB) {
	t.Helper()
	deps, db := embedContextDepsWithDB(t)
	require.NoError(t, db.Create(&podDomain.Pod{
		OrganizationID: 21,
		PodKey:         "embed-pod",
		RunnerID:       44,
		CreatedByID:    11,
		Status:         podStatus,
		AgentStatus:    podDomain.AgentStatusIdle,
		AgentSlug:      "do-agent",
	}).Error)
	encoded, err := json.Marshal(workerinterface.Response{
		Status:  status,
		Headers: map[string][]string{"Content-Type": {"application/json"}},
		BodyB64: base64.StdEncoding.EncodeToString([]byte(body)),
	})
	require.NoError(t, err)
	sandbox := &interfaceProxySandboxStub{
		connected: true,
		result: &runnerv1.SandboxFsResultEvent{
			Content:  string(encoded),
			Encoding: workerinterface.ResponseEncoding,
		},
	}
	deps.SandboxFs = sandbox
	deps.Pod = agentpodservice.NewPodService(infra.NewPodRepository(db))
	return deps, sandbox, db
}

type interfaceProxySandboxStub struct {
	connected bool
	command   *runnerv1.SandboxFsCommand
	result    *runnerv1.SandboxFsResultEvent
}

func (s *interfaceProxySandboxStub) IsConnected(int64) bool { return s.connected }

func (s *interfaceProxySandboxStub) Exec(
	_ context.Context,
	_ int64,
	command *runnerv1.SandboxFsCommand,
) (*runnerv1.SandboxFsResultEvent, error) {
	s.command = command
	return s.result, nil
}
