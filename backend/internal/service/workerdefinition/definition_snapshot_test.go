package workerdefinition

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseSnapshotRejectsNonJSONConfigDocument(t *testing.T) {
	source := []byte(
		`{"schema_version":1,"slug":"codex-cli","definition_version":"1",` +
			`"executable":"codex","adapter_id":"codex-app-server",` +
			`"interaction_modes":["pty"],` +
			`"model_requirement":{"required":false,"protocol_adapters":[]},` +
			`"credential_bindings":[],"config_documents":[` +
			`{"id":"settings","format":"yaml","target_path":"settings.yaml","required":false}],` +
			`"image":{"runtime":"codex-cli","version_probe":["codex","--version"]}}`,
	)

	_, err := ParseSnapshot(source, "AGENT codex\nMODE pty\n")

	require.ErrorContains(t, err, "config document must declare")
}

func TestParseSnapshotRejectsCredentialGroupWithUnknownTarget(t *testing.T) {
	source := []byte(
		`{"schema_version":1,"slug":"codex-cli","definition_version":"1",` +
			`"executable":"codex","adapter_id":"codex-app-server",` +
			`"interaction_modes":["pty"],` +
			`"model_requirement":{"required":false,"protocol_adapters":[]},` +
			`"credential_bindings":[{"id":"openai","source":{"kind":"credential_bundle","ref":"codex-cli"},"target":{"kind":"env","name":"OPENAI_API_KEY"}}],` +
			`"credential_requirement_groups":[{"id":"provider-api-key","any_of":["OPENAI_API_KEY","ANTHROPIC_API_KEY"]}],` +
			`"config_documents":[],"image":{"runtime":"codex-cli","version_probe":["codex","--version"]}}`,
	)

	_, err := ParseSnapshot(source, "AGENT codex\nENV OPENAI_API_KEY SECRET OPTIONAL\n")

	require.ErrorContains(t, err, `references undeclared target "ANTHROPIC_API_KEY"`)
}

func TestParseSnapshotOmitsEntitlementAsOpen(t *testing.T) {
	source := []byte(
		`{"schema_version":1,"slug":"codex-cli","definition_version":"1",` +
			`"executable":"codex","adapter_id":"codex-app-server",` +
			`"interaction_modes":["pty"],` +
			`"model_requirement":{"required":false,"protocol_adapters":[]},` +
			`"credential_bindings":[],"config_documents":[],` +
			`"image":{"runtime":"codex-cli","version_probe":["codex","--version"]}}`,
	)

	definition, err := ParseSnapshot(source, "AGENT codex\nMODE pty\n")

	require.NoError(t, err)
	require.Empty(t, definition.Entitlement.Default)
}

func TestParseSnapshotReadsClosedEntitlement(t *testing.T) {
	source := []byte(
		`{"schema_version":1,"slug":"codex-cli","definition_version":"1",` +
			`"executable":"codex","adapter_id":"codex-app-server",` +
			`"interaction_modes":["pty"],` +
			`"model_requirement":{"required":false,"protocol_adapters":[]},` +
			`"credential_bindings":[],"config_documents":[],` +
			`"image":{"runtime":"codex-cli","version_probe":["codex","--version"]},` +
			`"entitlement":{"default":"closed","note":"grayscale rollout"}}`,
	)

	definition, err := ParseSnapshot(source, "AGENT codex\nMODE pty\n")

	require.NoError(t, err)
	require.Equal(t, "closed", definition.Entitlement.Default)
	require.Equal(t, "grayscale rollout", definition.Entitlement.Note)
}

func TestParseSnapshotRejectsInvalidEntitlementDefault(t *testing.T) {
	source := []byte(
		`{"schema_version":1,"slug":"codex-cli","definition_version":"1",` +
			`"executable":"codex","adapter_id":"codex-app-server",` +
			`"interaction_modes":["pty"],` +
			`"model_requirement":{"required":false,"protocol_adapters":[]},` +
			`"credential_bindings":[],"config_documents":[],` +
			`"image":{"runtime":"codex-cli","version_probe":["codex","--version"]},` +
			`"entitlement":{"default":"maybe"}}`,
	)

	_, err := ParseSnapshot(source, "AGENT codex\nMODE pty\n")

	require.ErrorContains(t, err, "entitlement default must be open or closed")
}
