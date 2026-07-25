package operatorcatalog

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBootstrapVideoExpertsRejectsLegacyProtocolAdapterSnapshot(t *testing.T) {
	snapshots := newBootstrapSnapshotStore()
	bootstrapper := NewBootstrapper(
		&bootstrapSkillStore{},
		newBootstrapExpertStore(),
		&bootstrapWorkerPreparer{},
		snapshots,
		&bootstrapDependencyArtifactStore{},
	)
	request := validBootstrapRequest()
	_, err := bootstrapper.Run(context.Background(), request)
	require.NoError(t, err)
	for id, snapshot := range snapshots.rows {
		snapshot.Spec.Runtime.ModelBinding.ProtocolAdapter = ""
		snapshots.rows[id] = snapshot
	}

	_, err = bootstrapper.Run(context.Background(), request)

	require.ErrorIs(t, err, ErrCatalogConflict)
}
