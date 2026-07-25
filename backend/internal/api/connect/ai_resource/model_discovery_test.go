package airesourceconnect

import (
	"context"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
	service "github.com/l8ai-cn/agentcloud/backend/internal/service/airesource"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
	aiv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/ai_resource/v1"
)

type fakeDiscoveryService struct {
	Service
	discovery     service.ModelDiscoveryView
	importView    service.ModelImportView
	importInput   service.ImportModelsInput
	requestedID   int64
	discoveryErr  error
	importFailure error
}

func (f *fakeDiscoveryService) DiscoverConnectionModels(_ context.Context, _ service.Actor, connectionID int64) (service.ModelDiscoveryView, error) {
	f.requestedID = connectionID
	return f.discovery, f.discoveryErr
}

func (f *fakeDiscoveryService) ImportConnectionModels(_ context.Context, _ service.Actor, connectionID int64, input service.ImportModelsInput) (service.ModelImportView, error) {
	f.requestedID, f.importInput = connectionID, input
	return f.importView, f.importFailure
}

func TestDiscoverConnectionModelsProjectsCandidates(t *testing.T) {
	svc := &fakeDiscoveryService{discovery: service.ModelDiscoveryView{
		ConnectionID: 9, ProviderKey: slugkit.Slug("custom-openai-compatible"),
		Candidates: []service.ModelCandidateView{
			{
				ModelID: "gpt-5.4", DisplayName: "GPT 5.4", Identifier: slugkit.Slug("gpt-5-4"),
				Modalities: []domain.Modality{domain.ModalityChat}, Capabilities: []domain.Capability{domain.CapabilityTextGeneration},
				Importable: true,
			},
			{ModelID: "*", SkipReason: service.SkipUnusableModelID},
		},
	}}
	srv := NewServer(svc, fakeOrgService{})

	response, err := srv.DiscoverConnectionModels(userContext(7), connect.NewRequest(&aiv1.DiscoverConnectionModelsRequest{ConnectionId: 9}))
	require.NoError(t, err)

	assert.EqualValues(t, 9, svc.requestedID)
	assert.EqualValues(t, 9, response.Msg.GetConnectionId())
	assert.Equal(t, "custom-openai-compatible", response.Msg.GetProviderKey())
	require.Len(t, response.Msg.GetCandidates(), 2)
	first := response.Msg.GetCandidates()[0]
	assert.Equal(t, "gpt-5.4", first.GetModelId())
	assert.Equal(t, "gpt-5-4", first.GetIdentifier())
	assert.Equal(t, []string{"chat"}, first.GetModalities())
	assert.Equal(t, []string{"text-generation"}, first.GetCapabilities())
	assert.True(t, first.GetImportable())
	assert.Equal(t, "unusable-model-id", response.Msg.GetCandidates()[1].GetSkipReason())
}

func TestImportConnectionModelsForwardsSelectionAndReportsSkips(t *testing.T) {
	svc := &fakeDiscoveryService{importView: service.ModelImportView{
		ConnectionID: 9,
		Imported:     []service.ResourceView{{ID: 4, ProviderConnectionID: 9, Identifier: slugkit.Slug("gpt-5-4"), ModelID: "gpt-5.4"}},
		Skipped:      []service.SkippedModelView{{ModelID: "ghost", Reason: service.SkipNotDiscovered}},
	}}
	srv := NewServer(svc, fakeOrgService{})

	response, err := srv.ImportConnectionModels(userContext(7), connect.NewRequest(&aiv1.ImportConnectionModelsRequest{
		ConnectionId: 9, ModelIds: []string{"gpt-5.4", "ghost"},
	}))
	require.NoError(t, err)

	assert.Equal(t, []string{"gpt-5.4", "ghost"}, svc.importInput.ModelIDs)
	require.Len(t, response.Msg.GetImported(), 1)
	assert.Equal(t, "gpt-5.4", response.Msg.GetImported()[0].GetModelId())
	require.Len(t, response.Msg.GetSkipped(), 1)
	assert.Equal(t, "not-discovered", response.Msg.GetSkipped()[0].GetReason())
}

func TestDiscoveryErrorsMapToTypedConnectCodes(t *testing.T) {
	tests := []struct {
		failure error
		code    connect.Code
	}{
		{service.ErrDiscoveryUnsupported, connect.CodeUnimplemented},
		{service.ErrDiscovery, connect.CodeFailedPrecondition},
		{service.ErrInvalidCredentials, connect.CodeInvalidArgument},
		{service.ErrForbidden, connect.CodePermissionDenied},
	}
	for _, test := range tests {
		srv := NewServer(&fakeDiscoveryService{discoveryErr: test.failure}, fakeOrgService{})
		_, err := srv.DiscoverConnectionModels(userContext(7), connect.NewRequest(&aiv1.DiscoverConnectionModelsRequest{ConnectionId: 9}))
		assert.Equal(t, test.code, connect.CodeOf(err), test.failure)
	}
}

func TestDiscoveryRequiresAuthentication(t *testing.T) {
	srv := NewServer(&fakeDiscoveryService{}, fakeOrgService{})
	_, err := srv.DiscoverConnectionModels(context.Background(), connect.NewRequest(&aiv1.DiscoverConnectionModelsRequest{ConnectionId: 9}))
	assert.Equal(t, connect.CodeUnauthenticated, connect.CodeOf(err))
	_, err = srv.ImportConnectionModels(context.Background(), connect.NewRequest(&aiv1.ImportConnectionModelsRequest{ConnectionId: 9}))
	assert.Equal(t, connect.CodeUnauthenticated, connect.CodeOf(err))
}
