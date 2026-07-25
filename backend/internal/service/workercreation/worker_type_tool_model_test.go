package workercreation

import (
	"testing"

	resourcedomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/workerdefinition"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestToolModelRequirementsFromDefinitionPreservesSeedanceContract(t *testing.T) {
	requirements, err := toolModelRequirementsFromDefinition(workerdefinition.Definition{
		ToolModelRequirements: []workerdefinition.ToolModelRequirement{
			{
				ID:               "seedance-video",
				ProviderKeys:     []string{"doubao", "sub2api-seedance"},
				ProtocolAdapters: []string{"openai-compatible", "ark-seedance"},
				Modality:         "video",
				Capability:       "video-generation",
				Required:         true,
				Environment: workerdefinition.ToolModelEnvironment{
					APIKey: "SEEDANCE_API_KEY", BaseURL: "SEEDANCE_BASE_URL",
					ModelID: "SEEDANCE_MODEL",
				},
			},
		},
	})

	require.NoError(t, err)
	require.Len(t, requirements, 1)
	assert.Equal(t, "seedance-video", requirements[0].Role.String())
	assert.Equal(t, resourcedomain.ModalityVideo, requirements[0].Modality)
	assert.Equal(t, resourcedomain.CapabilityVideoGeneration, requirements[0].Capability)
	assert.Equal(t, "SEEDANCE_MODEL", requirements[0].Environment.ModelID)
	assert.True(t, requirements[0].Required)
}

func TestToolModelRequirementsFromDefinitionPreservesOptionalFlag(t *testing.T) {
	requirements, err := toolModelRequirementsFromDefinition(workerdefinition.Definition{
		ToolModelRequirements: []workerdefinition.ToolModelRequirement{
			{
				ID:               "minimax-video",
				ProviderKeys:     []string{"custom-openai-compatible", "minimax"},
				ProtocolAdapters: []string{"openai-compatible", "minimax"},
				Modality:         "video",
				Capability:       "video-generation",
				Required:         false,
				Environment: workerdefinition.ToolModelEnvironment{
					APIKey: "MINIMAX_VIDEO_API_KEY", BaseURL: "MINIMAX_VIDEO_BASE_URL",
					ModelID: "MINIMAX_VIDEO_MODEL",
				},
			},
		},
	})

	require.NoError(t, err)
	require.Len(t, requirements, 1)
	assert.Equal(t, "minimax-video", requirements[0].Role.String())
	assert.False(t, requirements[0].Required)
}
