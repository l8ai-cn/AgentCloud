package airesource

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDiscoverAndImportAgainstOpenAIShapedGateway(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/models", r.URL.Path)
		assert.Equal(t, "Bearer gateway-secret", r.Header.Get("Authorization"))
		_, _ = io.WriteString(w, `{"object":"list","data":[
			{"id":"gpt-5.4","object":"model"},
			{"id":"gpt-image-1.5","object":"model"},
			{"id":"gpt-4o-realtime-preview","object":"model"},
			{"id":"*","object":"model"}
		]}`)
	}))
	defer server.Close()

	f := newFixture()
	lister, err := NewHTTPModelLister(server.Client())
	require.NoError(t, err)
	service, err := NewService(Dependencies{
		Repository: f.repo, Cipher: f.cipher, Members: f.members, Prober: f.prober,
		Lister: lister, Mutations: f.mutations, Endpoints: allowingEndpoints{},
	})
	require.NoError(t, err)

	connection, err := service.CreateConnection(context.Background(), actor(1), CreateConnectionInput{
		OwnerScope: domain.OwnerScopeUser, OwnerID: 1, Identifier: slugkit.Slug("gateway"),
		ProviderKey: slugkit.Slug("custom-openai-compatible"), Name: "Gateway",
		BaseURL: server.URL + "/v1", Credentials: map[string]string{"api_key": "gateway-secret"},
	})
	require.NoError(t, err)

	discovered, err := service.DiscoverConnectionModels(context.Background(), actor(1), connection.ID)
	require.NoError(t, err)
	require.Len(t, discovered.Candidates, 4)

	byID := map[string]ModelCandidateView{}
	for _, candidate := range discovered.Candidates {
		byID[candidate.ModelID] = candidate
	}
	assert.True(t, byID["gpt-5.4"].Importable)
	assert.Equal(t, []domain.Modality{domain.ModalityChat}, byID["gpt-5.4"].Modalities)
	assert.Equal(t, []domain.Modality{domain.ModalityImage}, byID["gpt-image-1.5"].Modalities)
	assert.Equal(t, []domain.Modality{domain.ModalityAudio}, byID["gpt-4o-realtime-preview"].Modalities)
	assert.False(t, byID["*"].Importable)
	assert.Equal(t, SkipUnusableModelID, byID["*"].SkipReason)

	imported, err := service.ImportConnectionModels(context.Background(), actor(1), connection.ID, ImportModelsInput{})
	require.NoError(t, err)
	assert.Len(t, imported.Imported, 3)
	assert.Equal(t, []SkippedModelView{{ModelID: "*", Reason: SkipUnusableModelID}}, imported.Skipped)

	again, err := service.ImportConnectionModels(context.Background(), actor(1), connection.ID, ImportModelsInput{})
	require.NoError(t, err)
	assert.Empty(t, again.Imported)
	assert.Len(t, again.Skipped, 4)
}
