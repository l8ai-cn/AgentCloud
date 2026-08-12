package expert

import (
	"context"
	"errors"
	"testing"

	expertdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/expert"
	"github.com/stretchr/testify/require"
)

type staticWorkerTypeLookup struct {
	available          map[string]struct{}
	entitled           map[string]struct{}
	enforceEntitlement bool
	err                error
	entitleErr         error
}

func (lookup staticWorkerTypeLookup) AssertWorkerTypeAvailable(_ context.Context, slug string) error {
	if lookup.err != nil {
		return lookup.err
	}
	if _, ok := lookup.available[slug]; ok {
		return nil
	}
	return errors.New("missing canonical definition")
}

func (lookup staticWorkerTypeLookup) AssertWorkerTypeEntitled(_ context.Context, _, _ int64, slug string) error {
	if lookup.entitleErr != nil {
		return lookup.entitleErr
	}
	if !lookup.enforceEntitlement {
		return nil
	}
	if _, ok := lookup.entitled[slug]; ok {
		return nil
	}
	return errors.New("worker type is not granted to this member")
}

func TestCreateRejectsUnknownWorkerType(t *testing.T) {
	store := newFakeStore()
	svc := NewService(Deps{
		Store: store,
		WorkerTypes: staticWorkerTypeLookup{
			available: map[string]struct{}{"claude-code": {}},
		},
	})

	_, err := svc.Create(context.Background(), &CreateExpertRequest{
		OrganizationID: 7,
		UserID:         1,
		Name:           "Ghost Partner",
		AgentSlug:      "does-not-exist",
	})
	require.ErrorIs(t, err, ErrExpertWorkerTypeUnavailable)
}

func TestCreateAcceptsKnownWorkerType(t *testing.T) {
	store := newFakeStore()
	svc := NewService(Deps{
		Store: store,
		WorkerTypes: staticWorkerTypeLookup{
			available: map[string]struct{}{"claude-code": {}},
		},
	})

	row, err := svc.Create(context.Background(), &CreateExpertRequest{
		OrganizationID: 7,
		UserID:         1,
		Name:           "Analyst",
		AgentSlug:      "claude-code",
	})
	require.NoError(t, err)
	require.Equal(t, "claude-code", row.AgentSlug)
}

func TestUpdateRejectsUnknownWorkerType(t *testing.T) {
	store := newFakeStore()
	svc := NewService(Deps{
		Store: store,
		WorkerTypes: staticWorkerTypeLookup{
			available: map[string]struct{}{"claude-code": {}},
		},
	})
	created, err := svc.Create(context.Background(), &CreateExpertRequest{
		OrganizationID: 7,
		UserID:         1,
		Name:           "Analyst",
		AgentSlug:      "claude-code",
	})
	require.NoError(t, err)

	unknown := "does-not-exist"
	_, err = svc.Update(context.Background(), &UpdateExpertRequest{
		OrganizationID: 7,
		ExpertID:       created.ID,
		AgentSlug:      &unknown,
	})
	require.ErrorIs(t, err, ErrExpertWorkerTypeUnavailable)
}

func TestRunRejectsUnentitledWorkerType(t *testing.T) {
	store := newFakeStore()
	snapshotID := int64(901)
	require.NoError(t, store.Create(context.Background(), &expertdom.Expert{
		OrganizationID: 7, Slug: "analyst", Name: "Analyst", AgentSlug: "claude-code",
		WorkerSpecSnapshotID: &snapshotID, CreatedByID: 1,
	}))

	svc := NewService(Deps{
		Store:    store,
		Dispatch: &fakeDispatcher{},
		WorkerTypes: staticWorkerTypeLookup{
			available:          map[string]struct{}{"claude-code": {}},
			enforceEntitlement: true,
		},
	})
	_, err := svc.Run(context.Background(), &RunExpertRequest{
		OrganizationID: 7, UserID: 1, ExpertSlug: "analyst",
	})
	require.ErrorIs(t, err, ErrExpertWorkerTypeUnavailable)
}
