package agentpod

import (
	"errors"
	"fmt"
	"sort"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
)

var ErrLaunchEnvUndeclared = errors.New(
	"launch env is not declared by the worker spec",
)

// applyLaunchEnv writes caller-supplied per-run values into the evaluated pod
// environment. Undeclared names are rejected rather than dropped, so a caller
// never believes it configured a worker that silently ignored the value.
// Declared names win over env-bundle values because the whole point of a launch
// env is that the caller knows something the stored bundle cannot.
func applyLaunchEnv(
	existing map[string]string,
	launchEnv map[string]string,
	spec *specdomain.Spec,
) error {
	if len(launchEnv) == 0 {
		return nil
	}
	declared := map[string]bool{}
	if spec != nil {
		declared = spec.TypeConfig.LaunchEnvNames()
	}
	undeclared := make([]string, 0, len(launchEnv))
	for name := range launchEnv {
		if !declared[name] {
			undeclared = append(undeclared, name)
		}
	}
	if len(undeclared) > 0 {
		sort.Strings(undeclared)
		return fmt.Errorf("%w: %v", ErrLaunchEnvUndeclared, undeclared)
	}
	for name, value := range launchEnv {
		existing[name] = value
	}
	return nil
}
