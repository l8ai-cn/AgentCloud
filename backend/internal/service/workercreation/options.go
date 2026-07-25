package workercreation

import (
	"context"
	"fmt"

	runtimedomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerruntime"
	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
)

type OptionsFilter struct {
	WorkerTypeSlug  string
	ComputeTargetID *int64
	DeploymentMode  specdomain.DeploymentMode
}

type CreateOptions struct {
	Revision         string
	WorkerTypes      []WorkerTypeOption
	RuntimeImages    []RuntimeImageOption
	ComputeTargets   []ComputeTargetOption
	DeploymentModes  []DeploymentModeOption
	ResourceProfiles []ResourceProfileOption
}

type WorkerTypeOption struct {
	Slug                       string
	Name                       string
	Description                string
	Schema                     specdomain.TypeSchema
	SupportedInteractionModes  []specdomain.InteractionMode
	RequiresModelResource      bool
	ModelProtocolAdapters      []string
	ToolModelRequirements      []specdomain.ToolModelRequirement
	CredentialRequirements     []WorkerCredentialRequirement
	ConfigDocumentRequirements []WorkerConfigDocumentRequirement
	Selectable                 bool
	BlockingReason             string
}

type RuntimeImageOption struct {
	Image          runtimedomain.CatalogRuntimeImage
	Selectable     bool
	BlockingReason string
}

type ComputeTargetOption struct {
	Target         runtimedomain.CatalogComputeTarget
	Selectable     bool
	BlockingReason string
}

type DeploymentModeOption struct {
	Value          specdomain.DeploymentMode
	Name           string
	Selectable     bool
	BlockingReason string
}

type ResourceProfileOption struct {
	Profile        runtimedomain.CatalogResourceProfile
	Selectable     bool
	BlockingReason string
}

func (service *Service) ListOptions(
	ctx context.Context,
	scope specservice.Scope,
	filter OptionsFilter,
) (CreateOptions, error) {
	if service == nil || service.agents == nil || service.workerTypes == nil ||
		service.runners == nil || service.revision == "" {
		return CreateOptions{}, specservice.ErrResolverUnavailable
	}
	if scope.OrgID <= 0 || scope.UserID <= 0 {
		return CreateOptions{}, specservice.ErrInvalidScope
	}
	if filter.DeploymentMode != "" &&
		filter.DeploymentMode != specdomain.DeploymentModePooled &&
		filter.DeploymentMode != specdomain.DeploymentModeDedicated {
		return CreateOptions{}, &specservice.InvalidDraftFieldError{
			Field:  "deployment_mode",
			Reason: fmt.Sprintf("unsupported value %q", filter.DeploymentMode),
		}
	}
	workerTypes, err := service.listWorkerTypeOptions(ctx, scope, filter.WorkerTypeSlug)
	if err != nil {
		return CreateOptions{}, err
	}
	return CreateOptions{
		Revision:         service.revision,
		WorkerTypes:      workerTypes,
		RuntimeImages:    runtimeImageOptions(service.catalog, workerTypes),
		ComputeTargets:   computeTargetOptions(service.catalog),
		DeploymentModes:  deploymentModeOptions(service.catalog, filter.ComputeTargetID),
		ResourceProfiles: resourceProfileOptions(service.catalog),
	}, nil
}

func hasEnabledRuntimeImage(catalog runtimedomain.Catalog, workerType string) bool {
	for _, image := range catalog.ImagesFor(workerType) {
		if image.Enabled {
			return true
		}
	}
	return false
}

func runtimeImageOptions(
	catalog runtimedomain.Catalog,
	workerTypes []WorkerTypeOption,
) []RuntimeImageOption {
	workerTypesBySlug := make(map[string]WorkerTypeOption, len(workerTypes))
	for _, workerType := range workerTypes {
		workerTypesBySlug[workerType.Slug] = workerType
	}
	options := make([]RuntimeImageOption, 0, len(workerTypes))
	for _, image := range catalog.Images() {
		if len(image.WorkerTypeSlugs) != 1 {
			continue
		}
		workerType, exists := workerTypesBySlug[image.WorkerTypeSlugs[0]]
		if !exists {
			continue
		}
		option := RuntimeImageOption{Image: image, Selectable: image.Enabled && workerType.Selectable}
		if !image.Enabled {
			option.BlockingReason = "Runtime image is disabled"
		} else if !workerType.Selectable {
			option.BlockingReason = workerType.BlockingReason
		}
		options = append(options, option)
	}
	return options
}
