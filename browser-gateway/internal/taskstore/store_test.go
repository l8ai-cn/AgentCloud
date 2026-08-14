package taskstore

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseDriver(t *testing.T) {
	driver, err := ParseDriver("")
	require.NoError(t, err)
	require.Equal(t, DriverUnconfigured, driver)

	driver, err = ParseDriver("stub")
	require.NoError(t, err)
	require.Equal(t, DriverStub, driver)

	_, err = ParseDriver("playwright")
	require.Error(t, err)
}

func TestCreateStubCompletesWithoutSecrets(t *testing.T) {
	store := New(1, DriverStub)
	task := store.Create(Job{
		ThreadID: "thread-1",
		UserID:   "user-1",
		Username: "campus-user",
		Password: "secret",
	})
	require.NotEmpty(t, task.ID)
	require.Equal(t, "queued", task.Status)

	var got *Task
	require.Eventually(t, func() bool {
		var ok bool
		got, ok = store.Get(task.ID)
		return ok && got.Status == "completed"
	}, time.Second, 10*time.Millisecond)
	require.Equal(t, "stub-"+task.ID, got.Result["booking_id"])
	require.NotContains(t, got.Result, "password")
	require.NotContains(t, got.Result, "username")
}

func TestCreateUnconfiguredFails(t *testing.T) {
	store := New(1, DriverUnconfigured)
	task := store.Create(Job{ThreadID: "thread-1", UserID: "user-1"})
	require.Eventually(t, func() bool {
		got, ok := store.Get(task.ID)
		return ok && got.Status == "failed"
	}, time.Second, 10*time.Millisecond)
	got, _ := store.Get(task.ID)
	require.Contains(t, got.Error, "browser_unconfigured")
}

func TestGetMissing(t *testing.T) {
	store := New(1, DriverStub)
	_, ok := store.Get("missing")
	require.False(t, ok)
}
