package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/l8ai-cn/agentcloud/marketplace/internal/service"
	"github.com/stretchr/testify/require"
)

func TestLocalRuntimeInstallResolvesOrganizationSlug(t *testing.T) {
	installer := &expertInstallerStub{expertID: 42}
	bridge := &localRuntimeBridge{
		installer: installer,
		orgs: &orgGatewayStub{
			slug:    "target-org",
			allowed: true,
		},
	}
	result, err := bridge.Install(context.Background(), service.RuntimeInstallRequest{
		InstallationID:       "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		PlatformResourceType: "expert",
		PlatformResourceID:   7,
		SourceReleaseID:      9,
		TargetOrganizationID: 3,
		ActorUserID:          11,
		RuntimeSnapshot:      json.RawMessage(`{"version":1}`),
		Configuration:        json.RawMessage(`{"model_resource_id":5}`),
	})
	require.NoError(t, err)
	require.Equal(t, "expert:42", result.RuntimeRef)
	require.Equal(t, "target-org", installer.request.TargetOrganizationSlug)
	require.Equal(t, int64(5), installer.request.ModelResourceID)
}

func TestLocalRuntimeAuthorizeRejectsNonMember(t *testing.T) {
	bridge := &localRuntimeBridge{
		orgs: &orgGatewayStub{allowed: false},
	}
	err := bridge.Authorize(context.Background(), 3, 11)
	require.ErrorIs(t, err, service.ErrTargetOrganizationForbidden)
}

type expertInstallerStub struct {
	request  ExpertInstallRequest
	expertID int64
	err      error
}

func (s *expertInstallerStub) InstallMarketplaceExpert(
	_ context.Context,
	request ExpertInstallRequest,
) (int64, bool, error) {
	s.request = request
	return s.expertID, false, s.err
}

type orgGatewayStub struct {
	slug    string
	allowed bool
	err     error
}

func (s *orgGatewayStub) IsMember(context.Context, int64, int64) (bool, error) {
	return s.allowed, s.err
}

func (s *orgGatewayStub) OrganizationSlug(context.Context, int64) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	if s.slug == "" {
		return "", errors.New("missing organization")
	}
	return s.slug, nil
}
