package runner

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/l8ai-cn/agentcloud/runner/internal/cache"
	"github.com/l8ai-cn/agentcloud/runner/internal/config"
	"github.com/l8ai-cn/agentcloud/runner/internal/logger"
	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

// OnUpdatePodSkills materializes a skill remount inside a live sandbox. Perpetual
// restarts reuse the same sandbox without re-running setup, so without this the
// new bindings would only appear after the worker is rebuilt from scratch.
func (h *RunnerMessageHandler) OnUpdatePodSkills(
	cmd *runnerv1.UpdatePodSkillsCommand,
) error {
	log := logger.Pod()
	podKey := cmd.GetPodKey()
	pod, ok := h.podStore.Get(podKey)
	if !ok {
		return fmt.Errorf("pod not found: %s", podKey)
	}
	if pod.SandboxPath == "" {
		return fmt.Errorf("pod %s has no sandbox to remount skills into", podKey)
	}

	ctx := h.runner.GetRunContext()
	cfg := h.runner.GetConfig()
	if len(cmd.GetAdd()) > 0 {
		downloader, err := newSkillDownloader(cfg)
		if err != nil {
			return err
		}
		for _, res := range cmd.GetAdd() {
			if _, err := downloader.DownloadAndExtract(
				ctx, res, pod.SandboxPath, pod.WorkDir,
			); err != nil {
				return fmt.Errorf("mount skill %s: %w", res.GetSha(), err)
			}
		}
	}
	for _, target := range cmd.GetRemoveTargetPaths() {
		if err := removeSkillDirectory(target, pod.SandboxPath, pod.WorkDir); err != nil {
			return err
		}
	}
	log.Info("Pod skills remounted",
		"pod_key", podKey, "added", len(cmd.GetAdd()), "removed", len(cmd.GetRemoveTargetPaths()))
	return nil
}

func newSkillDownloader(cfg *config.Config) (*cache.Downloader, error) {
	cacheManager, err := cache.NewSkillCacheManager(
		filepath.Join(cfg.WorkspaceRoot, "cache", "skills"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create skill cache manager: %w", err)
	}
	hostAliases := make(map[string]string, len(cfg.ResourceHostAliases))
	for _, alias := range cfg.ResourceHostAliases {
		hostAliases[alias.Host] = alias.DialHost
	}
	return cache.NewDownloaderWithHostAliases(cacheManager, hostAliases), nil
}

// Unmount resolves through the same escape-checked resolver as the download path,
// so a hostile target path cannot delete outside the sandbox.
func removeSkillDirectory(target, sandboxRoot, workDir string) error {
	resolved, err := cache.ResolveResourcePath(target, sandboxRoot, workDir)
	if err != nil {
		return fmt.Errorf("unmount skill %s: %w", target, err)
	}
	if err := os.RemoveAll(resolved); err != nil {
		return fmt.Errorf("unmount skill %s: %w", target, err)
	}
	return nil
}
