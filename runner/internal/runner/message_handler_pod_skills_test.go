package runner

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoveSkillDirectoryDropsResolvedSandboxPath(t *testing.T) {
	sandboxRoot := t.TempDir()
	workDir := filepath.Join(sandboxRoot, "repo")
	mounted := filepath.Join(workDir, ".claude", "skills", "lint-guard")
	require.NoError(t, os.MkdirAll(mounted, 0o755))

	require.NoError(t, removeSkillDirectory(
		"{{.sandbox.work_dir}}/.claude/skills/lint-guard", sandboxRoot, workDir,
	))

	_, err := os.Stat(mounted)
	assert.True(t, os.IsNotExist(err))
}

func TestRemoveSkillDirectoryIsIdempotent(t *testing.T) {
	sandboxRoot := t.TempDir()
	assert.NoError(t, removeSkillDirectory(
		"{{.sandbox.root_path}}/skills/never-mounted", sandboxRoot, sandboxRoot,
	))
}

// Unmount takes a path from the wire, so escaping the sandbox must be refused
// rather than deleting whatever the traversal points at.
func TestRemoveSkillDirectoryRefusesSandboxEscape(t *testing.T) {
	sandboxRoot := t.TempDir()
	outside := filepath.Join(filepath.Dir(sandboxRoot), "outside-skill")
	require.NoError(t, os.MkdirAll(outside, 0o755))

	err := removeSkillDirectory(
		"{{.sandbox.root_path}}/../outside-skill", sandboxRoot, sandboxRoot,
	)

	require.Error(t, err)
	_, statErr := os.Stat(outside)
	assert.NoError(t, statErr)
}
