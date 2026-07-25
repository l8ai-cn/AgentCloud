package airesource

import (
	"context"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
)

func (s *Service) DiscoverConnectionModels(ctx context.Context, actor Actor, connectionID int64) (ModelDiscoveryView, error) {
	connection, candidates, err := s.discoverCandidates(ctx, actor, connectionID)
	if err != nil {
		return ModelDiscoveryView{}, err
	}
	return ModelDiscoveryView{ConnectionID: connection.ID, ProviderKey: connection.ProviderKey, Candidates: candidates}, nil
}

func (s *Service) ImportConnectionModels(ctx context.Context, actor Actor, connectionID int64, input ImportModelsInput) (ModelImportView, error) {
	connection, candidates, err := s.discoverCandidates(ctx, actor, connectionID)
	if err != nil {
		return ModelImportView{}, err
	}
	requested, selective := requestedModelIDs(input.ModelIDs)
	view := ModelImportView{ConnectionID: connection.ID}
	for _, candidate := range candidates {
		if selective && !requested[candidate.ModelID] {
			continue
		}
		delete(requested, candidate.ModelID)
		if !candidate.Importable {
			view.Skipped = append(view.Skipped, SkippedModelView{ModelID: candidate.ModelID, Reason: candidate.SkipReason})
			continue
		}
		resource, createErr := s.CreateResource(ctx, actor, CreateResourceInput{
			ConnectionID: connection.ID, Identifier: candidate.Identifier, ModelID: candidate.ModelID,
			DisplayName: candidate.DisplayName, Modalities: candidate.Modalities, Capabilities: candidate.Capabilities,
		})
		if createErr != nil {
			return ModelImportView{}, createErr
		}
		view.Imported = append(view.Imported, resource)
	}
	for _, modelID := range input.ModelIDs {
		trimmed := strings.TrimSpace(modelID)
		if requested[trimmed] {
			delete(requested, trimmed)
			view.Skipped = append(view.Skipped, SkippedModelView{ModelID: trimmed, Reason: SkipNotDiscovered})
		}
	}
	return view, nil
}

func (s *Service) discoverCandidates(ctx context.Context, actor Actor, connectionID int64) (*domain.Connection, []ModelCandidateView, error) {
	connection, _, err := s.connectionForActor(ctx, actor, connectionID, true)
	if err != nil {
		return nil, nil, err
	}
	provider, exists := domain.Provider(connection.ProviderKey.String())
	if !exists {
		return nil, nil, ErrInvalidProvider
	}
	shape, supported := domain.ModelListShapeFor(provider.Key.String())
	if !supported || !provider.SupportsModelDiscovery {
		return nil, nil, ErrDiscoveryUnsupported
	}
	credentials, err := s.decryptCredentials(connection)
	if err != nil {
		return nil, nil, err
	}
	if err := s.endpoints.Validate(ctx, connection.BaseURL); err != nil {
		return nil, nil, err
	}
	discovered, err := s.lister.List(ctx, ListModelsInput{
		Provider: provider, Shape: shape, BaseURL: connection.BaseURL, Credentials: credentials,
	})
	if err != nil {
		return nil, nil, err
	}
	imported, err := s.repository.ListResourcesByConnection(ctx, connection.ID)
	if err != nil {
		return nil, nil, err
	}
	return connection, modelCandidates(provider, discovered, imported), nil
}

func modelCandidates(provider domain.ProviderDefinition, discovered []domain.DiscoveredModel, imported []*domain.ModelResource) []ModelCandidateView {
	taken := make(map[string]struct{}, len(imported)*2)
	for _, resource := range imported {
		taken[resource.Identifier.String()] = struct{}{}
		taken[resource.ModelID] = struct{}{}
	}
	candidates := make([]ModelCandidateView, 0, len(discovered))
	seen := make(map[string]struct{}, len(discovered))
	for _, model := range discovered {
		if _, duplicate := seen[model.ModelID]; duplicate {
			continue
		}
		seen[model.ModelID] = struct{}{}
		candidates = append(candidates, modelCandidate(provider, model, taken))
	}
	return candidates
}

func modelCandidate(provider domain.ProviderDefinition, model domain.DiscoveredModel, taken map[string]struct{}) ModelCandidateView {
	candidate := ModelCandidateView{ModelID: model.ModelID, DisplayName: model.DisplayName}
	identifier, err := domain.DeriveModelIdentifier(model.ModelID)
	if err != nil {
		candidate.SkipReason = SkipUnusableModelID
		return candidate
	}
	profile, kept := domain.RestrictProfileToProvider(provider, domain.InferModelProfile(model.ModelID))
	if !kept {
		candidate.SkipReason = SkipUnsupportedModality
		return candidate
	}
	candidate.Identifier = identifier
	candidate.Modalities, candidate.Capabilities = profile.Modalities, profile.Capabilities
	if _, exists := taken[identifier.String()]; exists {
		candidate.SkipReason = SkipAlreadyImported
		return candidate
	}
	if _, exists := taken[model.ModelID]; exists {
		candidate.SkipReason = SkipAlreadyImported
		return candidate
	}
	taken[identifier.String()] = struct{}{}
	candidate.Importable = true
	return candidate
}

func requestedModelIDs(modelIDs []string) (map[string]bool, bool) {
	requested := make(map[string]bool, len(modelIDs))
	for _, modelID := range modelIDs {
		if trimmed := strings.TrimSpace(modelID); trimmed != "" {
			requested[trimmed] = true
		}
	}
	return requested, len(requested) > 0
}
