import { podApi } from "@/lib/api";
import type { WorkerSpecDraft } from "@/lib/api/facade/podConnect";

/** Best-effort soft fill; intent-selected type/model stay authoritative. */
export async function enrichDraftWithAIFill(
  prompt: string,
  draft: WorkerSpecDraft,
): Promise<WorkerSpecDraft> {
  try {
    const filled = await podApi.fillWorkerDraft(
      prompt,
      draft,
      draft.model_resource_id > 0 ? draft.model_resource_id : undefined,
    );
    return {
      ...filled.draft,
      worker_type_slug: draft.worker_type_slug,
      model_resource_id: draft.model_resource_id,
      runtime_image_id: draft.runtime_image_id || filled.draft.runtime_image_id,
      compute_target_id:
        draft.compute_target_id || filled.draft.compute_target_id,
      deployment_mode: draft.deployment_mode || filled.draft.deployment_mode,
      resource_profile_id:
        draft.resource_profile_id || filled.draft.resource_profile_id,
      options_revision:
        draft.options_revision || filled.draft.options_revision,
      config_document_bindings:
        draft.config_document_bindings.length > 0
          ? draft.config_document_bindings
          : filled.draft.config_document_bindings,
      initial_task: draft.initial_task || filled.draft.initial_task,
      alias: draft.alias || filled.draft.alias,
    };
  } catch {
    return draft;
  }
}
