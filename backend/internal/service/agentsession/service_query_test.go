package agentsession_test

import (
	"context"
	"testing"

	podDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentsession"
	svc "github.com/l8ai-cn/agentcloud/backend/internal/service/agentsession"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	queryOrgID  int64 = 7
	queryUserID int64 = 42
)

func seedPod(t *testing.T, db *gorm.DB, orgID int64, podKey, alias, status string) {
	t.Helper()
	require.NoError(t, db.Exec(
		"INSERT INTO pods (pod_key, organization_id, alias, status) VALUES (?, ?, ?, ?)",
		podKey, orgID, alias, status,
	).Error)
}

func seedSession(t *testing.T, s *svc.Service, orgID, userID int64, podKey string) string {
	t.Helper()
	id, err := svc.NewID()
	require.NoError(t, err)
	require.NoError(t, s.Create(context.Background(), &domain.Session{
		ID: id, OrganizationID: orgID, UserID: userID,
		PodKey: podKey, AgentSlug: "do-agent", Status: "idle",
	}))
	return id
}

func queryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := testDB(t)
	require.NoError(t, db.Exec(
		"CREATE TABLE pods (pod_key TEXT PRIMARY KEY, organization_id INTEGER, alias TEXT, status TEXT)",
	).Error)
	return db
}

func listedPodKeys(t *testing.T, s *svc.Service, opts svc.ListOptions) []string {
	t.Helper()
	rows, err := s.ListForUser(context.Background(), queryOrgID, queryUserID, opts)
	require.NoError(t, err)
	keys := make([]string, 0, len(rows))
	for _, row := range rows {
		keys = append(keys, row.PodKey)
	}
	return keys
}

func TestListForUserFiltersByAlias(t *testing.T) {
	db := queryTestDB(t)
	s := svc.NewService(db)
	seedPod(t, db, queryOrgID, "pod-wanted", "teacher-assistant", podDomain.StatusRunning)
	seedPod(t, db, queryOrgID, "pod-other", "lab-runner", podDomain.StatusRunning)
	seedSession(t, s, queryOrgID, queryUserID, "pod-wanted")
	seedSession(t, s, queryOrgID, queryUserID, "pod-other")

	got := listedPodKeys(t, s, svc.ListOptions{Alias: "teacher-assistant"})

	assert.Equal(t, []string{"pod-wanted"}, got)
}

func TestListForUserAliasDoesNotCrossTenants(t *testing.T) {
	db := queryTestDB(t)
	s := svc.NewService(db)
	seedPod(t, db, queryOrgID+1, "pod-foreign", "teacher-assistant", podDomain.StatusRunning)
	seedSession(t, s, queryOrgID, queryUserID, "pod-foreign")

	got := listedPodKeys(t, s, svc.ListOptions{Alias: "teacher-assistant"})

	assert.Empty(t, got)
}

// A completed pod surfaces as `idle` in the session view, so the reusable
// filter has to reject it from the pod lifecycle rather than the session row.
func TestListForUserReusableOnlyExcludesFinishedPods(t *testing.T) {
	db := queryTestDB(t)
	s := svc.NewService(db)
	seedPod(t, db, queryOrgID, "pod-disconnected", "teacher-assistant", podDomain.StatusDisconnected)
	seedPod(t, db, queryOrgID, "pod-completed", "teacher-assistant", podDomain.StatusCompleted)
	seedPod(t, db, queryOrgID, "pod-terminated", "teacher-assistant", podDomain.StatusTerminated)
	seedSession(t, s, queryOrgID, queryUserID, "pod-disconnected")
	seedSession(t, s, queryOrgID, queryUserID, "pod-completed")
	seedSession(t, s, queryOrgID, queryUserID, "pod-terminated")

	got := listedPodKeys(t, s, svc.ListOptions{Alias: "teacher-assistant", ReusableOnly: true})

	assert.Equal(t, []string{"pod-disconnected"}, got)
}

func TestListForUserWithoutPodFiltersIgnoresPodTable(t *testing.T) {
	db := queryTestDB(t)
	s := svc.NewService(db)
	seedSession(t, s, queryOrgID, queryUserID, "pod-unregistered")

	got := listedPodKeys(t, s, svc.ListOptions{})

	assert.Equal(t, []string{"pod-unregistered"}, got)
}
