package runner

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestStartSkillDomainServersRunsHook(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("domain server hook uses sh")
	}
	workDir := t.TempDir()
	skillDir := filepath.Join(workDir, ".agent", "skills", "learning-companion")
	require.NoError(t, os.MkdirAll(filepath.Join(skillDir, "bin"), 0o755))
	marker := filepath.Join(workDir, "started.marker")
	script := "#!/bin/sh\nset -eu\ntouch \"$AI_WORKER_WORKSPACE_ROOT/started.marker\"\n"
	require.NoError(t, os.WriteFile(
		filepath.Join(skillDir, "bin", "start-domain-server.sh"),
		[]byte(script),
		0o644,
	))

	require.NoError(t, startSkillDomainServers(context.Background(), workDir))
	require.Eventually(t, func() bool {
		_, err := os.Stat(marker)
		return err == nil
	}, 2*time.Second, 20*time.Millisecond)
}

func TestStartSkillDomainServersSkipsMissingRoots(t *testing.T) {
	require.NoError(t, startSkillDomainServers(context.Background(), t.TempDir()))
}
