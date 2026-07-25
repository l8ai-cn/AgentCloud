package airesource

import (
	"context"
	"net/http"
	"testing"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func listModels(t *testing.T, providerKey string, doer *captureDoer) ([]domain.DiscoveredModel, error) {
	t.Helper()
	provider, ok := domain.Provider(providerKey)
	require.True(t, ok)
	shape, ok := domain.ModelListShapeFor(providerKey)
	require.True(t, ok)
	lister, err := NewHTTPModelLister(doer)
	require.NoError(t, err)
	return lister.List(context.Background(), ListModelsInput{
		Provider: provider, Shape: shape, BaseURL: provider.DefaultBaseURL,
		Credentials: map[string]string{"api_key": "secret"},
	})
}

func TestHTTPModelListerReplaysTheProviderCheckRequest(t *testing.T) {
	doer := &captureDoer{status: http.StatusOK, body: `{"data":[{"id":"gpt-5.4"}]}`}
	models, err := listModels(t, "openai", doer)
	require.NoError(t, err)
	assert.Equal(t, "/v1/models", doer.request.URL.Path)
	assert.Equal(t, "Bearer secret", doer.request.Header.Get("Authorization"))
	assert.Equal(t, []domain.DiscoveredModel{{ModelID: "gpt-5.4", DisplayName: "gpt-5.4"}}, models)
}

func TestHTTPModelListerReadsEveryRegisteredListShape(t *testing.T) {
	tests := []struct {
		provider string
		body     string
		want     domain.DiscoveredModel
	}{
		{"openai", `{"data":[{"id":"gpt-5.4","object":"model"}]}`, domain.DiscoveredModel{ModelID: "gpt-5.4", DisplayName: "gpt-5.4"}},
		{"anthropic", `{"data":[{"id":"claude-opus-4-6","display_name":"Claude Opus 4.6"}]}`, domain.DiscoveredModel{ModelID: "claude-opus-4-6", DisplayName: "Claude Opus 4.6"}},
		{"gemini", `{"models":[{"name":"models/gemini-3-pro","displayName":"Gemini 3 Pro"}]}`, domain.DiscoveredModel{ModelID: "gemini-3-pro", DisplayName: "Gemini 3 Pro"}},
	}
	for _, test := range tests {
		models, err := listModels(t, test.provider, &captureDoer{status: http.StatusOK, body: test.body})
		require.NoError(t, err, test.provider)
		assert.Equal(t, []domain.DiscoveredModel{test.want}, models, test.provider)
	}
}

func TestHTTPModelListerDropsEntriesWithoutAModelID(t *testing.T) {
	models, err := listModels(t, "openai", &captureDoer{status: http.StatusOK, body: `{"data":[{"id":""},{"id":"  "},{"id":"gpt-5.4"}]}`})
	require.NoError(t, err)
	assert.Len(t, models, 1)
}

func TestHTTPModelListerMapsProviderFailuresToTypedErrors(t *testing.T) {
	tests := []struct {
		name   string
		doer   *captureDoer
		expect error
	}{
		{"unauthorized", &captureDoer{status: http.StatusUnauthorized, body: `{}`}, ErrInvalidCredentials},
		{"missing endpoint", &captureDoer{status: http.StatusNotFound, body: `{}`}, ErrProviderEndpointUnavailable},
		{"server error", &captureDoer{status: http.StatusBadGateway, body: `{}`}, ErrValidation},
		{"transport failure", &captureDoer{err: errInjected}, ErrDiscovery},
		{"unparsable payload", &captureDoer{status: http.StatusOK, body: `not-json`}, ErrDiscovery},
	}
	for _, test := range tests {
		_, err := listModels(t, "openai", test.doer)
		assert.ErrorIs(t, err, test.expect, test.name)
	}
}

func TestHTTPModelListerRejectsUnknownShapes(t *testing.T) {
	_, err := parseModelList(domain.ModelListShape("unregistered"), []byte(`{"data":[]}`))
	assert.ErrorIs(t, err, ErrDiscoveryUnsupported)
}

func TestHTTPModelListerRequiresAClient(t *testing.T) {
	_, err := NewHTTPModelLister(nil)
	assert.Error(t, err)
}
