package infra

import (
	"context"
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/internal/testkit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// GetByKey feeds PodService.GetPod → PodService.GetPod feeds the Connect
// GetPod response, which the web client upserts over its cached list entry.
// A narrower projection than ListByOrg silently blanks created_by there and
// drops the pod out of the "Mine" sidebar filter.
func TestPodRepositoryGetByKeyLoadsCreatedBy(t *testing.T) {
	db := testkit.SetupTestDB(t)
	require.NoError(t, db.Exec(`
INSERT INTO users (id, email, username, name)
VALUES (7, 'creator@example.com', 'creator', 'Pod Creator')
`).Error)
	require.NoError(t, db.Exec(`
INSERT INTO runners (id, organization_id, cluster_id, node_id)
VALUES (1, 77, 700, 'pod-get-runner')
`).Error)
	repo := &podRepo{db: db}
	pod := &agentpod.Pod{
		OrganizationID:  77,
		PodKey:          "77-pod-get-aabbccdd",
		RunnerID:        1,
		CreatedByID:     7,
		Status:          agentpod.StatusRunning,
		AgentStatus:     agentpod.AgentStatusIdle,
		InteractionMode: agentpod.InteractionModeACP,
		AutomationLevel: agentpod.AutomationLevelAutonomous,
	}
	require.NoError(t, repo.Create(context.Background(), pod))

	loaded, err := repo.GetByKey(context.Background(), pod.PodKey)

	require.NoError(t, err)
	require.NotNil(t, loaded.CreatedBy)
	assert.Equal(t, int64(7), loaded.CreatedBy.ID)
	assert.Equal(t, "creator", loaded.CreatedBy.Username)
}
