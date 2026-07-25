package airesourceconnect

import (
	"context"

	"connectrpc.com/connect"

	service "github.com/l8ai-cn/agentcloud/backend/internal/service/airesource"
	aiv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/ai_resource/v1"
)

func (s *Server) DiscoverConnectionModels(ctx context.Context, req *connect.Request[aiv1.DiscoverConnectionModelsRequest]) (*connect.Response[aiv1.DiscoverConnectionModelsResponse], error) {
	actor, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	view, err := s.service.DiscoverConnectionModels(ctx, actor, req.Msg.GetConnectionId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return connect.NewResponse(&aiv1.DiscoverConnectionModelsResponse{
		ConnectionId: view.ConnectionID, ProviderKey: view.ProviderKey.String(),
		Candidates: candidatesToProto(view.Candidates),
	}), nil
}

func (s *Server) ImportConnectionModels(ctx context.Context, req *connect.Request[aiv1.ImportConnectionModelsRequest]) (*connect.Response[aiv1.ImportConnectionModelsResponse], error) {
	actor, err := actorFromContext(ctx)
	if err != nil {
		return nil, err
	}
	view, err := s.service.ImportConnectionModels(ctx, actor, req.Msg.GetConnectionId(), service.ImportModelsInput{ModelIDs: req.Msg.GetModelIds()})
	if err != nil {
		return nil, mapServiceError(err)
	}
	imported := make([]*aiv1.ModelResource, len(view.Imported))
	for index := range view.Imported {
		imported[index] = resourceToProto(view.Imported[index])
	}
	skipped := make([]*aiv1.SkippedModel, len(view.Skipped))
	for index, item := range view.Skipped {
		skipped[index] = &aiv1.SkippedModel{ModelId: item.ModelID, Reason: string(item.Reason)}
	}
	return connect.NewResponse(&aiv1.ImportConnectionModelsResponse{
		ConnectionId: view.ConnectionID, Imported: imported, Skipped: skipped,
	}), nil
}

func candidatesToProto(candidates []service.ModelCandidateView) []*aiv1.DiscoveredModel {
	result := make([]*aiv1.DiscoveredModel, len(candidates))
	for index, candidate := range candidates {
		result[index] = &aiv1.DiscoveredModel{
			ModelId: candidate.ModelID, DisplayName: candidate.DisplayName, Identifier: candidate.Identifier.String(),
			Modalities: modalityStrings(candidate.Modalities), Capabilities: capabilityStrings(candidate.Capabilities),
			Importable: candidate.Importable, SkipReason: string(candidate.SkipReason),
		}
	}
	return result
}
