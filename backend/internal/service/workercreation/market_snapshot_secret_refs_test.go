package workercreation

import (
	"context"
	"testing"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrepareMarketSnapshotBindsRequiredCredentialBundles(t *testing.T) {
	fixture := freshCredentialBundleFixture()
	service := NewService(fixture.deps())
	source := portableCredentialMarketSource(t, service)

	snapshot, err := service.PrepareMarketSnapshot(
		context.Background(),
		specservice.Scope{
			OrgID:   88,
			OrgSlug: slugkit.MustNewForTest("target-org"),
			UserID:  7,
		},
		source,
		101,
		nil,
	)

	require.NoError(t, err)
	decoded, err := specdomain.DecodeSpec(snapshot.SpecJSON())
	require.NoError(t, err)
	assert.Equal(
		t,
		specdomain.SecretReference{
			Kind: slugkit.MustNewForTest("env-bundle"),
			ID:   8,
		},
		decoded.TypeConfig.SecretRefs["SIGNING_KEY"],
	)
}

func portableCredentialMarketSource(
	t *testing.T,
	service *Service,
) specdomain.Spec {
	t.Helper()
	draft := validWorkerCreationDraft()
	draft.WorkerSpec.TypeConfig.Values = map[string]any{}
	draft.WorkerSpec.TypeConfig.SecretRefs = map[string]specdomain.SecretReference{
		"SIGNING_KEY": {
			Kind: slugkit.MustNewForTest("env-bundle"),
			ID:   8,
		},
	}
	draft.WorkerSpec.Workspace.RepositoryID = nil
	draft.WorkerSpec.Workspace.Branch = ""
	draft.WorkerSpec.Workspace.KnowledgeMounts = []specdomain.KnowledgeMount{}
	draft.WorkerSpec.Workspace.EnvBundleIDs = []specdomain.RuntimeEnvBundleID{}
	prepared, err := service.Prepare(
		context.Background(),
		specservice.Scope{OrgID: 77, UserID: 7},
		draft,
	)
	require.NoError(t, err)
	source := prepared.Spec
	source.TypeConfig.SecretRefs = map[string]specdomain.SecretReference{}
	return source
}
