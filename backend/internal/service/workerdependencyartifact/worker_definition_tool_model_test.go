package workerdependencyartifact

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/workerdefinition"
	"github.com/stretchr/testify/require"
)

func TestValidateDefinitionToolModelsAllowsUnboundOptionalRole(t *testing.T) {
	definition := workerdefinition.Definition{
		ToolModelRequirements: []workerdefinition.ToolModelRequirement{
			{ID: "seedance-video", Required: false},
			{ID: "minimax-video", Required: false},
		},
	}

	err := validateDefinitionToolModels(definition, workerspec.Spec{})

	require.NoError(t, err)
}

func TestValidateDefinitionToolModelsRejectsUnboundRequiredRole(t *testing.T) {
	definition := workerdefinition.Definition{
		ToolModelRequirements: []workerdefinition.ToolModelRequirement{
			{ID: "seedance-video", Required: true},
		},
	}

	err := validateDefinitionToolModels(definition, workerspec.Spec{})

	require.ErrorContains(t, err, `requires tool model role "seedance-video"`)
}

func TestValidateDefinitionToolModelsRejectsUndeclaredBoundRole(t *testing.T) {
	definition := workerdefinition.Definition{
		ToolModelRequirements: []workerdefinition.ToolModelRequirement{
			{ID: "seedance-video", Required: false},
		},
	}
	spec := workerspec.Spec{}
	spec.Runtime.ToolModelBindings = []workerspec.ToolModelBinding{
		{Role: "unknown-video"},
	}

	err := validateDefinitionToolModels(definition, spec)

	require.ErrorContains(t, err, "rejects tool model role")
}
