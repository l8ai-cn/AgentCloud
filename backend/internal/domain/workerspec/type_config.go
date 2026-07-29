package workerspec

import "github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"

type InteractionMode string

const (
	InteractionModePTY InteractionMode = "pty"
	InteractionModeACP InteractionMode = "acp"
)

type AutomationLevel string

const (
	AutomationLevelInteractive AutomationLevel = "interactive"
	AutomationLevelAutoEdit    AutomationLevel = "auto_edit"
	AutomationLevelAutonomous  AutomationLevel = "autonomous"
)

type SecretReference struct {
	Kind slugkit.Slug `json:"kind"`
	ID   int64        `json:"id"`
}

// LaunchEnvField allowlists one environment variable the caller may supply per
// run. Values are never stored on the spec: only the name is declared, so a
// per-teacher credential stays out of the shared worker snapshot.
type LaunchEnvField struct {
	Name   string `json:"name"`
	Secret bool   `json:"secret"`
}

type TypeConfig struct {
	SchemaVersion   uint32                     `json:"schema_version"`
	Values          map[string]any             `json:"values"`
	SecretRefs      map[string]SecretReference `json:"secret_refs"`
	InteractionMode InteractionMode            `json:"interaction_mode"`
	AutomationLevel AutomationLevel            `json:"automation_level"`
	LaunchEnv       []LaunchEnvField           `json:"launch_env,omitempty"`
}

func (config TypeConfig) LaunchEnvNames() map[string]bool {
	names := make(map[string]bool, len(config.LaunchEnv))
	for _, field := range config.LaunchEnv {
		names[field.Name] = true
	}
	return names
}
