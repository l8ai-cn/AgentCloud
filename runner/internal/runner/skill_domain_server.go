package runner

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

const skillDomainStartScript = "bin/start-domain-server.sh"

// startSkillDomainServers launches per-skill HTTP domain servers after extract.
// Tar extract strips execute bits, so scripts are invoked via `sh`.
func startSkillDomainServers(ctx context.Context, workDir string) error {
	roots := skillInstallRoots(workDir)
	for _, root := range roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return fmt.Errorf("list skill root %s: %w", root, err)
		}
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			skillDir := filepath.Join(root, entry.Name())
			script := filepath.Join(skillDir, skillDomainStartScript)
			if _, err := os.Stat(script); err != nil {
				if os.IsNotExist(err) {
					continue
				}
				return err
			}
			if err := runSkillDomainStart(ctx, workDir, script); err != nil {
				return fmt.Errorf("start domain server for skill %s: %w", entry.Name(), err)
			}
		}
	}
	return nil
}

func skillInstallRoots(workDir string) []string {
	return []string{
		filepath.Join(workDir, ".agent", "skills"),
		filepath.Join(workDir, ".claude", "skills"),
		filepath.Join(workDir, "skills"),
	}
}

func runSkillDomainStart(ctx context.Context, workDir, script string) error {
	startCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(startCtx, "sh", script)
	cmd.Dir = workDir
	cmd.Env = append(os.Environ(),
		"AI_WORKER_WORKSPACE_ROOT="+workDir,
		"AI_WORKER_CWD="+workDir,
		"LEARNING_COMPANION_STORAGE=local",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%w: %s", err, truncateOutput(out, 2<<10))
	}
	return nil
}

func truncateOutput(out []byte, max int) string {
	if len(out) <= max {
		return string(out)
	}
	return string(out[:max]) + "…"
}
