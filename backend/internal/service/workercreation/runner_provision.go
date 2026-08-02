package workercreation

import (
	"context"
	"os"
	"strings"

	runtimedomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerruntime"
)

// RunnerProvisionChecker reports whether a missing Runner can still be
// auto-provisioned for an agent (coordinator launcher mode).
type RunnerProvisionChecker interface {
	CanProvisionRunnerForAgent(agentSlug string) bool
}

type provisionAwareRunnerAvailability struct {
	online    RunnerAvailabilityResolver
	provision RunnerProvisionChecker
}

func WithRunnerProvision(
	online RunnerAvailabilityResolver,
	provision RunnerProvisionChecker,
) RunnerAvailabilityResolver {
	if online == nil || provision == nil {
		return online
	}
	return provisionAwareRunnerAvailability{online: online, provision: provision}
}

func (resolver provisionAwareRunnerAvailability) HasAvailableRunnerForAgent(
	ctx context.Context,
	orgID, userID int64,
	agentSlug string,
) (bool, error) {
	available, err := resolver.online.HasAvailableRunnerForAgent(
		ctx, orgID, userID, agentSlug,
	)
	if err != nil || available {
		return available, err
	}
	return resolver.provision.CanProvisionRunnerForAgent(agentSlug), nil
}

type staticRunnerProvisionChecker map[string]struct{}

func (checker staticRunnerProvisionChecker) CanProvisionRunnerForAgent(
	agentSlug string,
) bool {
	_, ok := checker[strings.TrimSpace(agentSlug)]
	return ok
}

// ProvisionableAgentsFromEnv reads coordinator launcher mappings so the
// Worker wizard can offer types that will be provisioned on create.
func ProvisionableAgentsFromEnv() RunnerProvisionChecker {
	slugs := make(map[string]struct{})
	for _, raw := range []string{
		os.Getenv("COORDINATOR_RUNNER_DOCKER_COMPOSE_SERVICES"),
		os.Getenv(runtimedomain.RuntimeImageReferencesEnv),
	} {
		for _, part := range strings.Split(raw, ",") {
			key, _, ok := strings.Cut(strings.TrimSpace(part), "=")
			key = strings.TrimSpace(key)
			if ok && key != "" {
				slugs[key] = struct{}{}
			}
		}
	}
	if len(slugs) == 0 {
		return nil
	}
	return staticRunnerProvisionChecker(slugs)
}
