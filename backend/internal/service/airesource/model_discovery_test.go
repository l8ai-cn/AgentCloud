package airesource

import (
	"context"
	"testing"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func discovered(modelIDs ...string) []domain.DiscoveredModel {
	models := make([]domain.DiscoveredModel, 0, len(modelIDs))
	for _, modelID := range modelIDs {
		models = append(models, domain.DiscoveredModel{ModelID: modelID, DisplayName: modelID})
	}
	return models
}

func candidateByModelID(t *testing.T, candidates []ModelCandidateView, modelID string) ModelCandidateView {
	t.Helper()
	for _, candidate := range candidates {
		if candidate.ModelID == modelID {
			return candidate
		}
	}
	t.Fatalf("candidate %q missing", modelID)
	return ModelCandidateView{}
}

func TestDiscoverConnectionModelsInfersModalityAndIdentifier(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeUser, 1, "openai-main", "list-secret")
	f.lister.models = discovered("gpt-5.4", "gpt-image-1.5", "MiniMax-Hailuo-2.3", "text-embedding-3-large")

	view, err := f.service.DiscoverConnectionModels(context.Background(), actor(1), connection.ID)
	require.NoError(t, err)

	assert.Equal(t, connection.ID, view.ConnectionID)
	assert.Equal(t, slugkit.Slug("openai"), view.ProviderKey)
	require.Len(t, view.Candidates, 4)
	chat := candidateByModelID(t, view.Candidates, "gpt-5.4")
	assert.True(t, chat.Importable)
	assert.Equal(t, slugkit.Slug("gpt-5-4"), chat.Identifier)
	assert.Equal(t, []domain.Modality{domain.ModalityChat}, chat.Modalities)
	assert.Equal(t, []domain.Modality{domain.ModalityImage}, candidateByModelID(t, view.Candidates, "gpt-image-1.5").Modalities)
	assert.Equal(t, []domain.Modality{domain.ModalityVideo}, candidateByModelID(t, view.Candidates, "MiniMax-Hailuo-2.3").Modalities)
	assert.Equal(t, []domain.Modality{domain.ModalityEmbedding}, candidateByModelID(t, view.Candidates, "text-embedding-3-large").Modalities)

	require.Len(t, f.lister.calls, 1)
	call := f.lister.calls[0]
	assert.Equal(t, domain.ModelListShapeOpenAI, call.Shape)
	assert.Equal(t, connection.BaseURL, call.BaseURL)
	assert.Equal(t, map[string]string{"api_key": "list-secret"}, call.Credentials)
}

func TestDiscoverConnectionModelsMarksNonImportableCandidates(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeUser, 1, "openai-main", "secret")
	createResource(t, f, connection.ID, "already-here")
	f.lister.models = append(discovered("*", "gpt-5.4", "gpt-5.4"), domain.DiscoveredModel{ModelID: "provider/already-here", DisplayName: "dup"})

	view, err := f.service.DiscoverConnectionModels(context.Background(), actor(1), connection.ID)
	require.NoError(t, err)

	require.Len(t, view.Candidates, 3)
	wildcard := candidateByModelID(t, view.Candidates, "*")
	assert.False(t, wildcard.Importable)
	assert.Equal(t, SkipUnusableModelID, wildcard.SkipReason)
	assert.Empty(t, wildcard.Identifier)
	assert.True(t, candidateByModelID(t, view.Candidates, "gpt-5.4").Importable)
	existing := candidateByModelID(t, view.Candidates, "provider/already-here")
	assert.False(t, existing.Importable)
	assert.Equal(t, SkipAlreadyImported, existing.SkipReason)
}

func TestDiscoverConnectionModelsRejectsProvidersWithoutAListEndpoint(t *testing.T) {
	f := newFixture()
	view, err := f.service.CreateConnection(context.Background(), actor(1), CreateConnectionInput{
		OwnerScope: domain.OwnerScopeUser, OwnerID: 1, Identifier: "runway-main", ProviderKey: "runway",
		Name: "Runway", Credentials: map[string]string{"api_key": "secret"},
	})
	require.NoError(t, err)

	_, err = f.service.DiscoverConnectionModels(context.Background(), actor(1), view.ID)
	assert.ErrorIs(t, err, ErrDiscoveryUnsupported)
	assert.Empty(t, f.lister.calls)
}

func TestDiscoverConnectionModelsRequiresManagePermission(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeOrg, 10, "org-openai", "secret")
	_, err := f.service.DiscoverConnectionModels(context.Background(), actor(3), connection.ID)
	assert.ErrorIs(t, err, ErrForbidden)
	assert.Empty(t, f.lister.calls)
}

func TestImportConnectionModelsCreatesEveryImportableModelAndIsIdempotent(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeUser, 1, "openai-main", "secret")
	f.lister.models = discovered("gpt-5.4", "gpt-image-1.5", "*")

	view, err := f.service.ImportConnectionModels(context.Background(), actor(1), connection.ID, ImportModelsInput{})
	require.NoError(t, err)
	require.Len(t, view.Imported, 2)
	assert.Equal(t, []SkippedModelView{{ModelID: "*", Reason: SkipUnusableModelID}}, view.Skipped)
	assert.Equal(t, connection.ID, view.Imported[0].ProviderConnectionID)
	assert.Equal(t, "gpt-5.4", view.Imported[0].ModelID)
	assert.True(t, view.Imported[0].IsEnabled)

	repeated, err := f.service.ImportConnectionModels(context.Background(), actor(1), connection.ID, ImportModelsInput{})
	require.NoError(t, err)
	assert.Empty(t, repeated.Imported)
	assert.Len(t, repeated.Skipped, 3)
	resources, err := f.repo.ListResourcesByConnection(context.Background(), connection.ID)
	require.NoError(t, err)
	assert.Len(t, resources, 2)
}

func TestImportConnectionModelsHonoursTheRequestedSelection(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeUser, 1, "openai-main", "secret")
	f.lister.models = discovered("gpt-5.4", "gpt-image-1.5")

	view, err := f.service.ImportConnectionModels(context.Background(), actor(1), connection.ID, ImportModelsInput{
		ModelIDs: []string{"gpt-image-1.5", "gpt-nonexistent"},
	})
	require.NoError(t, err)

	require.Len(t, view.Imported, 1)
	assert.Equal(t, "gpt-image-1.5", view.Imported[0].ModelID)
	assert.Equal(t, []SkippedModelView{{ModelID: "gpt-nonexistent", Reason: SkipNotDiscovered}}, view.Skipped)
}

func TestImportConnectionModelsSurfacesDiscoveryFailures(t *testing.T) {
	f := newFixture()
	connection := createValidConnection(t, f, domain.OwnerScopeUser, 1, "openai-main", "secret")
	f.lister.err = ErrInvalidCredentials

	_, err := f.service.ImportConnectionModels(context.Background(), actor(1), connection.ID, ImportModelsInput{})
	assert.ErrorIs(t, err, ErrInvalidCredentials)
	resources, listErr := f.repo.ListResourcesByConnection(context.Background(), connection.ID)
	require.NoError(t, listErr)
	assert.Empty(t, resources)
}

func TestModelListerIsRequired(t *testing.T) {
	f := newFixture()
	_, err := NewService(Dependencies{
		Repository: f.repo, Cipher: f.cipher, Members: f.members, Prober: f.prober,
		Mutations: f.mutations, Endpoints: allowingEndpoints{},
	})
	assert.Error(t, err)
}
