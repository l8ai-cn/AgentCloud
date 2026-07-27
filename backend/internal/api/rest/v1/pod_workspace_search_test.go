package v1

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func TestPodWorkspaceSearchForwardsGlobsToRunner(t *testing.T) {
	sandbox := &fakePodWorkspaceSandbox{
		connected: true,
		result: &runnerv1.SandboxFsResultEvent{
			WorkspaceRoot: "/workspace",
			Entries: []*runnerv1.SandboxFsEntry{{
				Path:  "wiki/pages/graph/course_graph.md",
				Name:  "course_graph.md",
				Type:  "file",
				Bytes: 128,
			}},
		},
	}
	handler := podWorkspaceHandler(sandbox)
	recorder, ctx := podWorkspaceRequest(
		http.MethodGet,
		"/workers/worker-1/workspace/search?q=graph&include=wiki/pages/**/*.md&exclude=**/.git/**",
		"worker-1",
	)

	handler.SearchWorkspaceFilesystem(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.NotNil(t, sandbox.command)
	assert.Equal(t, "search", sandbox.command.GetOp())
	assert.Equal(t, "worker-1", sandbox.command.GetPodKey())
	assert.Equal(t, "graph", sandbox.command.GetPayload())
	assert.Equal(t, "wiki/pages/**/*.md", sandbox.command.GetIncludeGlob())
	assert.Equal(t, "**/.git/**", sandbox.command.GetExcludeGlob())

	var body struct {
		WorkspaceRoot string           `json:"workspace_root"`
		Data          []map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "/workspace", body.WorkspaceRoot)
	require.Len(t, body.Data, 1)
	assert.Equal(t, "wiki/pages/graph/course_graph.md", body.Data[0]["path"])
}

func TestPodWorkspaceSearchRejectsUnauthorizedReaderBeforeRunnerCall(t *testing.T) {
	sandbox := &fakePodWorkspaceSandbox{connected: true}
	handler := podWorkspaceHandler(sandbox)
	recorder, ctx := podWorkspaceRequest(
		http.MethodGet, "/workers/worker-1/workspace/search", "worker-1",
	)
	setPodTenantContext(ctx, 2, 22)

	handler.SearchWorkspaceFilesystem(ctx)

	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.Nil(t, sandbox.command)
}
