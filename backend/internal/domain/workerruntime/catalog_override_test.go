package workerruntime

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCatalogOverrideTogglesLockedWorkerTypes(t *testing.T) {
	catalog := DefaultCatalog()
	require.True(t, enabledFor(catalog, "codex-cli"))

	disabled, err := catalog.WithOverride(CatalogOverride{
		SchemaVersion: 1,
		Disabled:      []string{"codex-cli"},
	})
	require.NoError(t, err)
	require.False(t, enabledFor(disabled, "codex-cli"))

	restored, err := disabled.WithOverride(CatalogOverride{
		SchemaVersion: 1,
		Enabled:       []string{"codex-cli"},
	})

	require.NoError(t, err)
	assert.True(t, enabledFor(restored, "codex-cli"))
	assert.True(t, enabledFor(catalog, "codex-cli"))
}

func TestCatalogOverrideChangesRevision(t *testing.T) {
	catalog := DefaultCatalog()

	overridden, err := catalog.WithOverride(CatalogOverride{
		SchemaVersion: 1,
		Disabled:      []string{"codex-cli"},
	})

	require.NoError(t, err)
	assert.NotEqual(t, catalog.Revision(), overridden.Revision())
	assert.Contains(t, overridden.Revision(), catalog.Revision())
}

func TestCatalogOverrideKeepsRevisionWhenEmpty(t *testing.T) {
	catalog := DefaultCatalog()

	overridden, err := catalog.WithOverride(CatalogOverride{SchemaVersion: 1})

	require.NoError(t, err)
	assert.Equal(t, catalog.Revision(), overridden.Revision())
}

func TestCatalogOverrideRejectsUnlockedWorkerType(t *testing.T) {
	_, err := DefaultCatalog().WithOverride(CatalogOverride{
		SchemaVersion: 1,
		Enabled:       []string{"aider"},
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unlocked worker type")
}

func TestCatalogOverrideRejectsContradictoryToggles(t *testing.T) {
	_, err := DefaultCatalog().WithOverride(CatalogOverride{
		SchemaVersion: 1,
		Disabled:      []string{"codex-cli"},
		Enabled:       []string{"codex-cli"},
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "both enables and disables")
}

func TestLoadCatalogOverrideRequiresSchemaVersion(t *testing.T) {
	path := t.TempDir() + "/override.json"
	require.NoError(t, os.WriteFile(path, []byte(`{"disabled_worker_types":["codex-cli"]}`), 0o600))

	_, err := LoadCatalogOverride(path)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "schema_version must be 1")
}

func TestLoadCatalogOverrideReadsFile(t *testing.T) {
	path := t.TempDir() + "/override.json"
	require.NoError(t, os.WriteFile(
		path,
		[]byte(`{"schema_version":1,"disabled_worker_types":["codex-cli"]}`),
		0o600,
	))

	override, err := LoadCatalogOverride(path)

	require.NoError(t, err)
	assert.Equal(t, []string{"codex-cli"}, override.Disabled)
}

func TestLoadCatalogOverrideIsOptional(t *testing.T) {
	override, err := LoadCatalogOverride("")

	require.NoError(t, err)
	assert.True(t, override.empty())
}

func enabledFor(catalog Catalog, workerType string) bool {
	for _, image := range catalog.ImagesFor(workerType) {
		if image.Enabled {
			return true
		}
	}
	return false
}
