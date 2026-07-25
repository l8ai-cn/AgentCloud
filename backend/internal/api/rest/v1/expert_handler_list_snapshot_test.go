package v1

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	expertdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/expert"
	"github.com/l8ai-cn/agentcloud/backend/internal/middleware"
)

func TestListExpertsReturnsSnapshotBoundary(t *testing.T) {
	handler, _ := newResourceManagedExpertHandler()
	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/experts?limit=100&offset=0", nil)
	ctx.Set("tenant", &middleware.TenantContext{OrganizationID: 7, UserID: 5})

	handler.ListExperts(ctx)

	require.Equal(t, http.StatusOK, response.Code)
	var body struct {
		Experts       []expertdom.Expert `json:"experts"`
		Total         int64              `json:"total"`
		SnapshotMaxID int64              `json:"snapshot_max_id"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	require.Len(t, body.Experts, 1)
	require.Equal(t, int64(1), body.Total)
	require.Equal(t, int64(8), body.SnapshotMaxID)
}

func TestListExpertsRejectsInvalidSnapshotBoundary(t *testing.T) {
	handler, _ := newResourceManagedExpertHandler()
	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/experts?snapshot_max_id=invalid", nil)
	ctx.Set("tenant", &middleware.TenantContext{OrganizationID: 7, UserID: 5})

	handler.ListExperts(ctx)

	require.Equal(t, http.StatusBadRequest, response.Code)
}
