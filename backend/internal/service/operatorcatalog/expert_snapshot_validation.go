package operatorcatalog

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"strings"

	expertdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/expert"
	skilldom "github.com/l8ai-cn/agentcloud/backend/internal/domain/skill"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/workerdependency"
	specdom "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"
	"github.com/l8ai-cn/agentcloud/backend/internal/service/workercreation"
	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
	"gorm.io/gorm"
)

func (bootstrapper *Bootstrapper) validateExpertSnapshot(
	ctx context.Context,
	request BootstrapRequest,
	definition ExpertDefinition,
	expert *expertdom.Expert,
	skills map[string]*skilldom.Skill,
) error {
	if expert.WorkerSpecSnapshotID == nil {
		return ErrCatalogConflict
	}
	snapshot, err := bootstrapper.snapshots.GetByID(
		ctx,
		request.OrganizationID,
		*expert.WorkerSpecSnapshotID,
	)
	if err != nil {
		return err
	}
	expectedSkillIDs := make([]int64, 0, len(definition.SkillSlugs))
	for _, slug := range definition.SkillSlugs {
		row := skills[slug]
		if row == nil {
			return ErrCatalogConflict
		}
		expectedSkillIDs = append(expectedSkillIDs, row.ID)
	}
	slices.Sort(expectedSkillIDs)
	resolved, err := resolveDefinition(definition, request)
	if err != nil {
		return err
	}
	spec := snapshot.Spec
	if snapshot.ID != *expert.WorkerSpecSnapshotID ||
		snapshot.OrganizationID != request.OrganizationID ||
		!specdom.HasResolvedProtocolAdapters(spec) ||
		spec.Runtime.ModelBinding.ResourceID != resolved.ModelResourceID ||
		spec.Runtime.Image.ID != resolved.RuntimeImageID ||
		spec.Runtime.WorkerType.Slug != resolved.WorkerType ||
		spec.Workspace.Instructions != definition.Prompt ||
		!slices.Equal(spec.Workspace.SkillIDs, expectedSkillIDs) {
		return ErrCatalogConflict
	}
	if !workerConfigMatchesCatalog(spec.TypeConfig, resolved) {
		return bootstrapper.rebuildExpertSnapshotForDefinition(
			ctx,
			request,
			definition,
			expert,
			expectedSkillIDs,
		)
	}
	artifact, err := bootstrapper.artifacts.GetBySnapshotID(
		ctx,
		request.OrganizationID,
		snapshot.ID,
	)
	artifactFound := err == nil
	if artifactFound &&
		artifactMatchesInstructionContract(artifact) &&
		artifactSkillsMatchCatalog(artifact, skills) {
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return bootstrapper.rebuildOrBackfillExpertArtifact(
		ctx,
		request,
		definition,
		expert,
		expectedSkillIDs,
		artifactFound,
		snapshot.ID,
	)
}

func workerConfigMatchesCatalog(
	config specdom.TypeConfig,
	resolved resolvedDefinition,
) bool {
	return config.InteractionMode == resolved.InteractionMode &&
		config.AutomationLevel == specdom.AutomationLevelAutoEdit &&
		reflect.DeepEqual(config.SecretRefs, resolved.SecretRefs) &&
		reflect.DeepEqual(config.Values, resolved.ConfigOverrides)
}

func (bootstrapper *Bootstrapper) rebuildExpertSnapshotForDefinition(
	ctx context.Context,
	request BootstrapRequest,
	definition ExpertDefinition,
	expert *expertdom.Expert,
	expectedSkillIDs []int64,
) error {
	prepared, err := bootstrapper.prepareExpertSnapshot(
		ctx,
		request,
		definition,
		expectedSkillIDs,
	)
	if err != nil {
		return err
	}
	return bootstrapper.rebuildExpertSnapshot(ctx, request, expert, prepared)
}

func (bootstrapper *Bootstrapper) rebuildOrBackfillExpertArtifact(
	ctx context.Context,
	request BootstrapRequest,
	definition ExpertDefinition,
	expert *expertdom.Expert,
	expectedSkillIDs []int64,
	artifactFound bool,
	snapshotID int64,
) error {
	prepared, err := bootstrapper.prepareExpertSnapshot(
		ctx,
		request,
		definition,
		expectedSkillIDs,
	)
	if err != nil {
		return err
	}
	if artifactFound {
		return bootstrapper.rebuildExpertSnapshot(ctx, request, expert, prepared)
	}
	return bootstrapper.createSnapshotArtifact(ctx, request, snapshotID, prepared)
}

func (bootstrapper *Bootstrapper) prepareExpertSnapshot(
	ctx context.Context,
	request BootstrapRequest,
	definition ExpertDefinition,
	expectedSkillIDs []int64,
) (workercreation.Prepared, error) {
	resolved, err := resolveDefinition(definition, request)
	if err != nil {
		return workercreation.Prepared{}, err
	}
	return bootstrapper.workers.Prepare(
		ctx,
		specservice.Scope{
			OrgID:   request.OrganizationID,
			OrgSlug: request.OrganizationSlug,
			UserID:  request.PublisherUserID,
		},
		workerDraft(
			bootstrapper.workers.Revision(),
			request,
			definition,
			expectedSkillIDs,
			resolved,
		),
	)
}

func artifactMatchesInstructionContract(document workerdependency.Document) bool {
	source := strings.TrimSpace(document.Worker.AgentfileSource)
	return source != "" &&
		!strings.Contains("\n"+source+"\n", "\nPROMPT ") &&
		strings.Contains(source, `"/AGENTS.md"`)
}

func artifactSkillsMatchCatalog(
	document workerdependency.Document,
	skills map[string]*skilldom.Skill,
) bool {
	for _, pinned := range document.Skills {
		row := skills[pinned.Slug.String()]
		if row == nil {
			return false
		}
		digest := strings.TrimPrefix(strings.TrimSpace(pinned.ContentDigest), "sha256:")
		if digest == "" || digest != row.ContentSha || pinned.Version != row.Version {
			return false
		}
	}
	return true
}
