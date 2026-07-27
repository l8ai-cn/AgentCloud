package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	agentpoddomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
	sessionsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/agentsession"
	"github.com/l8ai-cn/agentcloud/backend/internal/testkit"
	"github.com/l8ai-cn/agentcloud/backend/pkg/embedtoken"
)

type stubEmbedPodLookup struct {
	status string
}

func (s *stubEmbedPodLookup) GetPod(
	_ context.Context,
	podKey string,
) (*agentpoddomain.Pod, error) {
	if podKey != embedTestPodKey {
		return nil, gorm.ErrRecordNotFound
	}
	status := s.status
	if status == "" {
		status = agentpoddomain.StatusRunning
	}
	return &agentpoddomain.Pod{PodKey: podKey, Status: status}, nil
}

const (
	embedTestOrgID  int64 = 21
	embedTestUserID int64 = 11
	embedTestPodKey       = "xueban-pod"
)

func TestWorkerEmbedContextIssuesTokenBoundToWorkerSession(t *testing.T) {
	handler := workerEmbedHandler(t)

	response := workerEmbedRequest(t, handler, embedTestPodKey, embedTestUserID, `{
		"parent_origins":["https://zhiyong.example"],
		"capabilities":["read","write","control"]
	}`)

	require.Equal(t, http.StatusCreated, response.Code, response.Body.String())
	var body struct {
		EmbedContext    string `json:"embed_context"`
		RedemptionProof string `json:"redemption_proof"`
		SessionID       string `json:"session_id"`
		PodKey          string `json:"pod_key"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "conv_xueban", body.SessionID)
	assert.Equal(t, embedTestPodKey, body.PodKey)
	require.NotEmpty(t, body.RedemptionProof)

	claims, err := handler.tokens.ValidateContext(body.EmbedContext)
	require.NoError(t, err)
	assert.Equal(t, "conv_xueban", claims.SessionID)
	assert.Equal(t, embedTestOrgID, claims.OrganizationID)
	assert.Equal(t, []string{"https://zhiyong.example"}, claims.AllowedParentOrigins)
	assert.Equal(t, []string{"read", "write", "control"}, claims.Capabilities)
}

func TestWorkerEmbedContextRedeemsIntoSessionToken(t *testing.T) {
	handler := workerEmbedHandler(t)
	response := workerEmbedRequest(t, handler, embedTestPodKey, embedTestUserID, `{
		"parent_origins":["https://zhiyong.example"],
		"capabilities":["read"]
	}`)
	require.Equal(t, http.StatusCreated, response.Code)
	var body struct {
		EmbedContext    string `json:"embed_context"`
		RedemptionProof string `json:"redemption_proof"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))

	accessToken, _, err := handler.tokens.RedeemContext(
		t.Context(),
		body.EmbedContext,
		body.RedemptionProof,
	)

	require.NoError(t, err)
	claims, err := handler.tokens.ValidateSession(accessToken)
	require.NoError(t, err)
	assert.Equal(t, "conv_xueban", claims.SessionID)
}

func TestWorkerEmbedContextRejectsWorkerFromAnotherKeyIdentity(t *testing.T) {
	handler := workerEmbedHandler(t)

	response := workerEmbedRequest(t, handler, embedTestPodKey, 99, `{
		"parent_origins":["https://zhiyong.example"],
		"capabilities":["read"]
	}`)

	assert.Equal(t, http.StatusForbidden, response.Code)
}

func TestWorkerEmbedContextHidesWorkersFromOtherOrganizations(t *testing.T) {
	handler := workerEmbedHandler(t)

	response := workerEmbedRequestForOrg(
		t, handler, embedTestPodKey, embedTestUserID, 999,
		`{"parent_origins":["https://zhiyong.example"],"capabilities":["read"]}`,
	)

	assert.Equal(t, http.StatusNotFound, response.Code)
}

func TestWorkerEmbedContextRejectsUnknownWorker(t *testing.T) {
	handler := workerEmbedHandler(t)

	response := workerEmbedRequest(t, handler, "missing-pod", embedTestUserID, `{
		"parent_origins":["https://zhiyong.example"],
		"capabilities":["read"]
	}`)

	assert.Equal(t, http.StatusNotFound, response.Code)
}

func TestWorkerEmbedContextRejectsInactiveWorker(t *testing.T) {
	handler := workerEmbedHandlerWithPodStatus(t, agentpoddomain.StatusTerminated)

	response := workerEmbedRequest(t, handler, embedTestPodKey, embedTestUserID, `{
		"parent_origins":["https://zhiyong.example"],
		"capabilities":["read"]
	}`)

	assert.Equal(t, http.StatusConflict, response.Code, response.Body.String())
}

func TestWorkerEmbedContextRejectsInvalidGrants(t *testing.T) {
	for name, body := range map[string]string{
		"wildcard origin":     `{"parent_origins":["*"],"capabilities":["read"]}`,
		"origin with path":    `{"parent_origins":["https://z.example/a"],"capabilities":["read"]}`,
		"missing origins":     `{"capabilities":["read"]}`,
		"unsupported ability": `{"parent_origins":["https://z.example"],"capabilities":["read","root"]}`,
		"read not requested":  `{"parent_origins":["https://z.example"],"capabilities":["write"]}`,
	} {
		t.Run(name, func(t *testing.T) {
			response := workerEmbedRequest(
				t, workerEmbedHandler(t), embedTestPodKey, embedTestUserID, body,
			)
			assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
		})
	}
}

func workerEmbedHandler(t *testing.T) *WorkerEmbedContextHandler {
	t.Helper()
	return workerEmbedHandlerWithPodStatus(t, agentpoddomain.StatusRunning)
}

func workerEmbedHandlerWithPodStatus(
	t *testing.T,
	status string,
) *WorkerEmbedContextHandler {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db := workerEmbedTestDB(t)
	require.NoError(t, db.Exec(
		`INSERT INTO agent_sessions (id, organization_id, user_id, pod_key, agent_slug)
		 VALUES (?, ?, ?, ?, ?)`,
		"conv_xueban", embedTestOrgID, embedTestUserID, embedTestPodKey, "do-agent",
	).Error)
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return NewWorkerEmbedContextHandler(
		sessionsvc.NewService(db),
		embedtoken.NewService("test-secret", client),
		nil,
		&stubEmbedPodLookup{status: status},
	)
}

func workerEmbedTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := testkit.SetupTestDB(t)
	require.NoError(t, db.Exec(`
		CREATE TABLE agent_sessions (
			id TEXT PRIMARY KEY,
			organization_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			pod_key TEXT NOT NULL UNIQUE,
			agent_slug TEXT NOT NULL,
			runner_node_id TEXT,
			title TEXT,
			status TEXT NOT NULL DEFAULT 'idle',
			parent_session_id TEXT,
			project TEXT,
			archived BOOLEAN NOT NULL DEFAULT FALSE,
			deleted_at DATETIME,
			mcp_servers TEXT NOT NULL DEFAULT '[]',
			codex_goal TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`).Error)
	return db
}

func workerEmbedRequest(
	t *testing.T,
	handler *WorkerEmbedContextHandler,
	podKey string,
	userID int64,
	body string,
) *httptest.ResponseRecorder {
	t.Helper()
	return workerEmbedRequestForOrg(t, handler, podKey, userID, embedTestOrgID, body)
}

func workerEmbedRequestForOrg(
	t *testing.T,
	handler *WorkerEmbedContextHandler,
	podKey string,
	userID int64,
	orgID int64,
	body string,
) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/v1/ext/orgs/acme/workers/"+podKey+"/embed-context",
		bytes.NewBufferString(body),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "key", Value: podKey}}
	c.Set("tenant", &middleware.TenantContext{
		OrganizationID:   orgID,
		OrganizationSlug: "acme",
		UserID:           userID,
		UserRole:         "apikey",
	})
	handler.CreateEmbedContext(c)
	return recorder
}
