package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/l8ai-cn/agentcloud/marketplace/internal/service"
)

type ExpertInstallRequest struct {
	InstallationID            string
	TargetOrganizationID      int64
	TargetOrganizationSlug    string
	ActorUserID               int64
	ModelResourceID           int64
	ToolModelResourceIDs      map[string]int64
	SourceMarketApplicationID int64
	SourceMarketReleaseID     int64
	RuntimeSnapshot           json.RawMessage
}

type ExpertInstaller interface {
	InstallMarketplaceExpert(
		context.Context,
		ExpertInstallRequest,
	) (expertID int64, alreadyInstalled bool, err error)
}

type localRuntimeBridge struct {
	installer ExpertInstaller
	orgs      OrganizationGateway
}

func (b *localRuntimeBridge) Authorize(
	ctx context.Context,
	organizationID, actorUserID int64,
) error {
	allowed, err := b.orgs.IsMember(ctx, organizationID, actorUserID)
	if err != nil {
		return fmt.Errorf("%w: %v", service.ErrRuntimeAuthorizationFailed, err)
	}
	if !allowed {
		return service.ErrTargetOrganizationForbidden
	}
	return nil
}

func (b *localRuntimeBridge) Install(
	ctx context.Context,
	request service.RuntimeInstallRequest,
) (service.RuntimeInstallResult, error) {
	if request.PlatformResourceType != "expert" {
		return service.RuntimeInstallResult{}, service.ErrRuntimeInstallationRejected
	}
	slug, err := b.orgs.OrganizationSlug(ctx, request.TargetOrganizationID)
	if err != nil || slug == "" {
		return service.RuntimeInstallResult{}, service.ErrRuntimeInstallationRejected
	}
	var configuration struct {
		ModelResourceID      int64            `json:"model_resource_id"`
		ToolModelResourceIDs map[string]int64 `json:"tool_model_resource_ids"`
	}
	if json.Unmarshal(request.Configuration, &configuration) != nil ||
		configuration.ModelResourceID <= 0 {
		return service.RuntimeInstallResult{}, service.ErrRuntimeInstallationRejected
	}
	expertID, existing, err := b.installer.InstallMarketplaceExpert(
		ctx,
		ExpertInstallRequest{
			InstallationID:            request.InstallationID,
			TargetOrganizationID:      request.TargetOrganizationID,
			TargetOrganizationSlug:    slug,
			ActorUserID:               request.ActorUserID,
			ModelResourceID:           configuration.ModelResourceID,
			ToolModelResourceIDs:      configuration.ToolModelResourceIDs,
			SourceMarketApplicationID: request.PlatformResourceID,
			SourceMarketReleaseID:     request.SourceReleaseID,
			RuntimeSnapshot:           request.RuntimeSnapshot,
		},
	)
	if err != nil {
		return service.RuntimeInstallResult{}, fmt.Errorf(
			"%w: %v",
			service.ErrRuntimeInstallationRejected,
			err,
		)
	}
	result, err := json.Marshal(map[string]any{
		"expert_id":         strconv.FormatInt(expertID, 10),
		"already_installed": existing,
	})
	if err != nil {
		return service.RuntimeInstallResult{}, service.ErrRuntimeInstallationUnknown
	}
	return service.RuntimeInstallResult{
		RuntimeRef: "expert:" + strconv.FormatInt(expertID, 10),
		Result:     result,
	}, nil
}
