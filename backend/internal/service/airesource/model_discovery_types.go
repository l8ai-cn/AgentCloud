package airesource

import (
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

type ListModelsInput struct {
	Provider    domain.ProviderDefinition
	Shape       domain.ModelListShape
	BaseURL     string
	Credentials map[string]string `json:"-"`
}

type SkipReason string

const (
	SkipAlreadyImported     SkipReason = "already-imported"
	SkipUnusableModelID     SkipReason = "unusable-model-id"
	SkipUnsupportedModality SkipReason = "unsupported-modality"
	SkipNotDiscovered       SkipReason = "not-discovered"
)

type ModelCandidateView struct {
	ModelID      string              `json:"model_id"`
	DisplayName  string              `json:"display_name"`
	Identifier   slugkit.Slug        `json:"identifier,omitempty"`
	Modalities   []domain.Modality   `json:"modalities,omitempty"`
	Capabilities []domain.Capability `json:"capabilities,omitempty"`
	Importable   bool                `json:"importable"`
	SkipReason   SkipReason          `json:"skip_reason,omitempty"`
}

type ModelDiscoveryView struct {
	ConnectionID int64                `json:"connection_id"`
	ProviderKey  slugkit.Slug         `json:"provider_key"`
	Candidates   []ModelCandidateView `json:"candidates"`
}

type SkippedModelView struct {
	ModelID string     `json:"model_id"`
	Reason  SkipReason `json:"reason"`
}

type ModelImportView struct {
	ConnectionID int64              `json:"connection_id"`
	Imported     []ResourceView     `json:"imported"`
	Skipped      []SkippedModelView `json:"skipped"`
}

type ImportModelsInput struct {
	// Empty imports every importable candidate; otherwise only these provider
	// model IDs are imported, and unknown IDs come back as not-discovered.
	ModelIDs []string
}
