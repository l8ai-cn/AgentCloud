package operatorcatalog

import (
	"fmt"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

func definitionRuntime(
	definition ExpertDefinition,
	request BootstrapRequest,
) (slugkit.Slug, int64, error) {
	slug, err := slugkit.NewFromTrusted(definitionWorkerType(definition))
	if err != nil {
		return "", 0, err
	}
	runtimeImageID := definition.RuntimeImageID
	if runtimeImageID == 0 {
		runtimeImageID = request.RuntimeImageID
	}
	return slug, runtimeImageID, nil
}

func definitionWorkerType(definition ExpertDefinition) string {
	if definition.WorkerTypeSlug == "" {
		return "video-studio"
	}
	return definition.WorkerTypeSlug
}

func definitionSecretRefs(
	definition ExpertDefinition,
	request BootstrapRequest,
) (map[string]specdomain.SecretReference, error) {
	if len(definition.SecretRefs) == 0 {
		return map[string]specdomain.SecretReference{}, nil
	}
	kind, err := slugkit.NewFromTrusted("env-bundle")
	if err != nil {
		return nil, err
	}
	refs := make(map[string]specdomain.SecretReference, len(definition.SecretRefs))
	for field, bundleName := range definition.SecretRefs {
		id := request.CredentialBundleIDs[bundleName]
		if id <= 0 {
			return nil, fmt.Errorf(
				"credential bundle %q is required for %s",
				bundleName,
				definition.Slug,
			)
		}
		refs[field] = specdomain.SecretReference{Kind: kind, ID: id}
	}
	return refs, nil
}

func partnerConfigOverrides() map[string]any {
	return map[string]any{"approval_mode": "never"}
}

func stringPointer(value string) *string { return &value }
