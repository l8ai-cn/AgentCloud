package workercreation

import (
	"context"
	"errors"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	agentservice "github.com/l8ai-cn/agentcloud/backend/internal/service/agent"
	entitlementsvc "github.com/l8ai-cn/agentcloud/backend/internal/service/entitlement"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

type workerTypeResolver struct {
	agents       AgentProvider
	definitions  WorkerDefinitionProvider
	entitlements *entitlementsvc.Service
	memberRoles  MemberRoleReader
}

func newWorkerTypeResolver(
	agents AgentProvider,
	definitions WorkerDefinitionProvider,
	entitlements *entitlementsvc.Service,
	memberRoles MemberRoleReader,
) *workerTypeResolver {
	return &workerTypeResolver{
		agents:       agents,
		definitions:  definitions,
		entitlements: entitlements,
		memberRoles:  memberRoles,
	}
}

func (resolver *workerTypeResolver) setEntitlements(gate *entitlementsvc.Service) {
	if resolver == nil {
		return
	}
	resolver.entitlements = gate
}

func (resolver *workerTypeResolver) ResolveWorkerType(
	ctx context.Context,
	scope specservice.Scope,
	slug slugkit.Slug,
) (specservice.WorkerTypeResolution, error) {
	if resolver == nil || resolver.agents == nil || resolver.definitions == nil {
		return specservice.WorkerTypeResolution{}, specservice.ErrResolverUnavailable
	}
	if err := requireWorkerTypeEntitlement(
		ctx,
		resolver.entitlements,
		resolver.memberRoles,
		scope,
		slug.String(),
	); err != nil {
		return specservice.WorkerTypeResolution{}, err
	}
	definition, ok := resolver.definitions.Get(slug.String())
	if !ok {
		return specservice.WorkerTypeResolution{}, invalidWorkerType("missing canonical definition")
	}
	agent, err := resolver.agents.GetAgent(ctx, slug.String())
	if err != nil {
		if errors.Is(err, agentservice.ErrAgentNotFound) {
			return specservice.WorkerTypeResolution{}, invalidWorkerType("worker type does not exist")
		}
		return specservice.WorkerTypeResolution{}, err
	}
	if err := validateWorkerTypeProjection(agent, slug, definition); err != nil {
		return specservice.WorkerTypeResolution{}, err
	}
	typeSchema, err := typeSchemaFromDefinition(definition)
	if err != nil {
		return specservice.WorkerTypeResolution{}, err
	}
	modes, err := parseSupportedInteractionModes(definition.Modes)
	if err != nil {
		return specservice.WorkerTypeResolution{}, err
	}
	modelRequirement, err := modelRequirementFromDefinition(slug, definition)
	if err != nil {
		return specservice.WorkerTypeResolution{}, err
	}
	toolModelRequirements, err := toolModelRequirementsFromDefinition(definition)
	if err != nil {
		return specservice.WorkerTypeResolution{}, err
	}
	return specservice.WorkerTypeResolution{
		WorkerType: specdomain.WorkerType{
			Slug:           slug,
			DefinitionHash: definition.DefinitionHash,
		},
		TypeSchema:                typeSchema,
		SupportedInteractionModes: modes,
		ModelRequirement:          modelRequirement,
		ToolModelRequirements:     toolModelRequirements,
	}, nil
}
