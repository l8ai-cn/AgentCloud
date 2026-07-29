package infra

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	"github.com/l8ai-cn/agentcloud/backend/internal/testkit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const idleReclaimOrgID = 91

func seedIdleSpec(t *testing.T, db *gorm.DB, id int64, specJSON string) {
	t.Helper()
	require.NoError(t, db.Exec(
		`INSERT INTO worker_spec_snapshots (id, organization_id, version, spec_json, summary_json)
		 VALUES (?, ?, 1, ?, ?)`,
		id, idleReclaimOrgID, []byte(specJSON), []byte("{}"),
	).Error)
}

func idleSpecJSON(policy string, timeoutMinutes int) string {
	return `{"version":1,"lifecycle":{"termination_policy":"` + policy +
		`","idle_timeout_minutes":` + strconv.Itoa(timeoutMinutes) + `}}`
}

func seedIdlePod(t *testing.T, db *gorm.DB, podKey string, snapshotID int64, status string, lastActivity time.Time) {
	t.Helper()
	require.NoError(t, db.Exec(
		`INSERT INTO pods (organization_id, pod_key, status, last_activity, worker_spec_snapshot_id)
		 VALUES (?, ?, ?, ?, ?)`,
		idleReclaimOrgID, podKey, status, lastActivity, snapshotID,
	).Error)
}

func TestListIdleExpiredPodKeysHonorsTheSpecBudget(t *testing.T) {
	db := testkit.SetupTestDB(t)
	now := time.Now()
	seedIdleSpec(t, db, 1, idleSpecJSON("idle", 30))
	seedIdlePod(t, db, "pod-expired", 1, agentpod.StatusRunning, now.Add(-45*time.Minute))
	seedIdlePod(t, db, "pod-within-budget", 1, agentpod.StatusRunning, now.Add(-10*time.Minute))

	keys, err := (&podRepo{db: db}).ListIdleExpiredPodKeys(context.Background(), now)

	require.NoError(t, err)
	assert.Equal(t, []string{"pod-expired"}, keys)
}

func TestListIdleExpiredPodKeysLeavesNonIdlePoliciesAlone(t *testing.T) {
	db := testkit.SetupTestDB(t)
	now := time.Now()
	seedIdleSpec(t, db, 1, idleSpecJSON("manual", 0))
	seedIdleSpec(t, db, 2, idleSpecJSON("completed", 0))
	seedIdlePod(t, db, "pod-manual", 1, agentpod.StatusRunning, now.Add(-100*time.Hour))
	seedIdlePod(t, db, "pod-completed", 2, agentpod.StatusRunning, now.Add(-100*time.Hour))

	keys, err := (&podRepo{db: db}).ListIdleExpiredPodKeys(context.Background(), now)

	require.NoError(t, err)
	assert.Empty(t, keys)
}

// A worker that already stopped has no compute left to reclaim, and listing it
// would make the reclaimer fight the terminate path over the same pod.
func TestListIdleExpiredPodKeysSkipsWorkersThatAlreadyEnded(t *testing.T) {
	db := testkit.SetupTestDB(t)
	now := time.Now()
	seedIdleSpec(t, db, 1, idleSpecJSON("idle", 30))
	for _, status := range []string{
		agentpod.StatusTerminated,
		agentpod.StatusCompleted,
		agentpod.StatusError,
	} {
		seedIdlePod(t, db, "pod-"+status, 1, status, now.Add(-100*time.Hour))
	}

	keys, err := (&podRepo{db: db}).ListIdleExpiredPodKeys(context.Background(), now)

	require.NoError(t, err)
	assert.Empty(t, keys)
}

func TestListIdleExpiredPodKeysIgnoresWorkersWithoutASpec(t *testing.T) {
	db := testkit.SetupTestDB(t)
	now := time.Now()
	require.NoError(t, db.Exec(
		`INSERT INTO pods (organization_id, pod_key, status, last_activity)
		 VALUES (?, 'pod-no-spec', ?, ?)`,
		idleReclaimOrgID, agentpod.StatusRunning, now.Add(-100*time.Hour),
	).Error)

	keys, err := (&podRepo{db: db}).ListIdleExpiredPodKeys(context.Background(), now)

	require.NoError(t, err)
	assert.Empty(t, keys)
}

// Zhiyong measures idle from last heartbeat, else started_at. Workers that
// never reported activity still have a create/start clock and must expire on
// that baseline rather than being skipped forever.
func TestListIdleExpiredPodKeysUsesStartClockWhenActivityIsMissing(t *testing.T) {
	db := testkit.SetupTestDB(t)
	now := time.Now()
	seedIdleSpec(t, db, 1, idleSpecJSON("idle", 30))
	require.NoError(t, db.Exec(
		`INSERT INTO pods (organization_id, pod_key, status, started_at, created_at, worker_spec_snapshot_id)
		 VALUES (?, 'pod-started', ?, ?, ?, ?)`,
		idleReclaimOrgID, agentpod.StatusRunning,
		now.Add(-45*time.Minute), now.Add(-50*time.Minute), 1,
	).Error)

	keys, err := (&podRepo{db: db}).ListIdleExpiredPodKeys(context.Background(), now)

	require.NoError(t, err)
	assert.Equal(t, []string{"pod-started"}, keys)
}

// A spec we cannot read says nothing about whether its worker is idle, so a
// decode regression must not become a mass termination.
func TestListIdleExpiredPodKeysSkipsUnreadableSpecs(t *testing.T) {
	db := testkit.SetupTestDB(t)
	now := time.Now()
	seedIdleSpec(t, db, 1, `{"version":1,"lifecycle":"not-an-object"}`)
	seedIdleSpec(t, db, 2, idleSpecJSON("idle", 30))
	seedIdlePod(t, db, "pod-unreadable", 1, agentpod.StatusRunning, now.Add(-100*time.Hour))
	seedIdlePod(t, db, "pod-readable", 2, agentpod.StatusRunning, now.Add(-100*time.Hour))

	keys, err := (&podRepo{db: db}).ListIdleExpiredPodKeys(context.Background(), now)

	require.NoError(t, err)
	assert.Equal(t, []string{"pod-readable"}, keys)
}
