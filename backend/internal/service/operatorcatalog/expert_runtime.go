package operatorcatalog

import (
	"fmt"
	"sort"

	specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/pkg/slugkit"
)

type resolvedDefinition struct {
	WorkerType      slugkit.Slug
	RuntimeImageID  int64
	ModelResourceID int64
	InteractionMode specdomain.InteractionMode
	ConfigOverrides map[string]any
	SecretRefs      map[string]specdomain.SecretReference
	ConfigDocuments []specdomain.ConfigDocumentBinding
	ConfigBundleIDs []int64
}

func resolveDefinition(
	definition ExpertDefinition,
	request BootstrapRequest,
) (resolvedDefinition, error) {
	workerType, runtimeImageID, err := definitionRuntime(definition, request)
	if err != nil {
		return resolvedDefinition{}, err
	}
	secretRefs, err := definitionSecretRefs(definition, request)
	if err != nil {
		return resolvedDefinition{}, err
	}
	documents, bundleIDs, err := definitionConfigDocuments(definition, request)
	if err != nil {
		return resolvedDefinition{}, err
	}
	return resolvedDefinition{
		WorkerType:      workerType,
		RuntimeImageID:  runtimeImageID,
		ModelResourceID: definitionModelResourceID(definition, request),
		InteractionMode: definitionInteractionMode(definition),
		ConfigOverrides: definitionConfigOverrides(definition),
		SecretRefs:      secretRefs,
		ConfigDocuments: documents,
		ConfigBundleIDs: bundleIDs,
	}, nil
}

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

func definitionModelResourceID(
	definition ExpertDefinition,
	request BootstrapRequest,
) int64 {
	if definition.ModelResourceID > 0 {
		return definition.ModelResourceID
	}
	return request.ModelResourceID
}

func definitionInteractionMode(definition ExpertDefinition) specdomain.InteractionMode {
	if definition.InteractionMode == string(specdomain.InteractionModeACP) {
		return specdomain.InteractionModeACP
	}
	return specdomain.InteractionModePTY
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
		id, err := bundleID(request, bundleName, definition.Slug)
		if err != nil {
			return nil, err
		}
		refs[field] = specdomain.SecretReference{Kind: kind, ID: id}
	}
	return refs, nil
}

func definitionConfigDocuments(
	definition ExpertDefinition,
	request BootstrapRequest,
) ([]specdomain.ConfigDocumentBinding, []int64, error) {
	documentIDs := make([]string, 0, len(definition.ConfigDocumentRefs))
	for documentID := range definition.ConfigDocumentRefs {
		documentIDs = append(documentIDs, documentID)
	}
	sort.Strings(documentIDs)
	bindings := make([]specdomain.ConfigDocumentBinding, 0, len(documentIDs))
	bundleIDs := make([]int64, 0, len(documentIDs))
	for _, documentID := range documentIDs {
		id, err := bundleID(
			request,
			definition.ConfigDocumentRefs[documentID],
			definition.Slug,
		)
		if err != nil {
			return nil, nil, err
		}
		bindings = append(bindings, specdomain.ConfigDocumentBinding{
			DocumentID:     documentID,
			ConfigBundleID: id,
		})
		bundleIDs = append(bundleIDs, id)
	}
	return bindings, bundleIDs, nil
}

// Market releases must stay portable across organizations, and a config
// document binding always points at an org-scoped config bundle, so experts
// that need one stay org-owned instead of being published.
func marketPublishable(definition ExpertDefinition) bool {
	return len(definition.ConfigDocumentRefs) == 0
}

func bundleID(
	request BootstrapRequest,
	bundleName string,
	expertSlug string,
) (int64, error) {
	id := request.CredentialBundleIDs[bundleName]
	if id <= 0 {
		return 0, fmt.Errorf(
			"credential bundle %q is required for %s",
			bundleName,
			expertSlug,
		)
	}
	return id, nil
}

func partnerConfigOverrides() map[string]any {
	return map[string]any{"approval_mode": "never"}
}

func definitionConfigOverrides(definition ExpertDefinition) map[string]any {
	if definition.ConfigOverrides != nil {
		return definition.ConfigOverrides
	}
	return partnerConfigOverrides()
}

func stringPointer(value string) *string { return &value }
