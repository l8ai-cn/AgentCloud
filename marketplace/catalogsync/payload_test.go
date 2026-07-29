package catalogsync

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildExpertCatalogPayloadEmbedsInstallableSnapshot(t *testing.T) {
	payload, err := buildExpertCatalogPayload(publishedExpertRelease{
		ApplicationID: 3,
		ReleaseID:     7,
		Version:       2,
		ExpertSnapshot: []byte(`{
			"version":1,
			"agent_slug":"video-studio",
			"skill_slugs":["video-editing","video-qa"]
		}`),
		WorkerSpecSnapshot: []byte(`{
			"version":1,
			"spec":{"version":1},
			"summary":{"worker_type":{"slug":"video-studio"}}
		}`),
	})

	require.NoError(t, err)
	require.Len(t, payload.ContentDigest, 64)
	require.Equal(t, "video-studio", payload.AgentSlug)
	require.JSONEq(t, `{"agents":["video-studio"]}`, string(payload.Compatibility))
	require.JSONEq(t, `{"skills":["video-editing","video-qa"]}`,
		string(payload.DependencyLock))

	var manifest map[string]any
	require.NoError(t, json.Unmarshal(payload.Manifest, &manifest))
	_, hasCredits := manifest["installation_credits"]
	require.False(t, hasCredits)
	source := manifest["source_release"].(map[string]any)
	require.Equal(t, float64(3), source["application_id"])
	require.Equal(t, float64(7), source["release_id"])
	require.Equal(t, float64(2), source["version"])
	runtime := manifest["runtime_snapshot"].(map[string]any)
	require.Equal(t, float64(1), runtime["version"])
	require.JSONEq(t, `{"version":1}`, mustJSON(t, runtime["worker_spec"]))
}

func TestBuildExpertCatalogPayloadRejectsInvalidWorkerSpec(t *testing.T) {
	_, err := buildExpertCatalogPayload(publishedExpertRelease{
		ReleaseID:          8,
		ExpertSnapshot:     []byte(`{"agent_slug":"video-studio"}`),
		WorkerSpecSnapshot: []byte(`{"version":1,"spec":null}`),
	})

	require.EqualError(t, err, "expert release 8 has an invalid worker spec")
}

func mustJSON(t *testing.T, value any) string {
	t.Helper()
	raw, err := json.Marshal(value)
	require.NoError(t, err)
	return string(raw)
}
