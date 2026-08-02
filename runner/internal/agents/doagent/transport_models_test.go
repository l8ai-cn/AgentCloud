package doagent

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadDoAgentSettingsAndListModels(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/models", r.URL.Path)
		assert.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]string{
				{"id": "gpt-5.5"},
				{"id": "gpt-5.4"},
			},
		})
	}))
	t.Cleanup(server.Close)

	path := filepath.Join(t.TempDir(), "settings.json")
	payload, err := json.Marshal(map[string]any{
		"model": "custom-openai-compatible/gpt-5.4",
		"provider": map[string]any{
			"custom-openai-compatible": map[string]any{
				"options": map[string]any{
					"apiKey":  "secret",
					"baseURL": server.URL + "/v1",
				},
			},
		},
	})
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, payload, 0o600))

	settings, err := readDoAgentSettings(path)
	require.NoError(t, err)
	assert.Equal(t, "custom-openai-compatible/gpt-5.4", settings.Model)
	assert.Equal(t, "custom-openai-compatible", settings.Provider)

	models, err := listProviderModels(settings)
	require.NoError(t, err)
	assert.Equal(t, []string{
		"custom-openai-compatible/gpt-5.5",
		"custom-openai-compatible/gpt-5.4",
	}, models)
}

func TestTransportSetCurrentModelKeepsUniqueList(t *testing.T) {
	tr := newTransport(acp.EventCallbacks{}, nil)
	tr.setCurrentModel("custom-openai-compatible/gpt-5.4")
	tr.setCurrentModel("custom-openai-compatible/gpt-5.5")
	tr.setCurrentModel("custom-openai-compatible/gpt-5.4")
	assert.Equal(t, "custom-openai-compatible/gpt-5.4", tr.CurrentModel())
	assert.Equal(t, []string{
		"custom-openai-compatible/gpt-5.4",
		"custom-openai-compatible/gpt-5.5",
	}, tr.SupportedModels())
}
