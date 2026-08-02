import { IssueSeverity, SourceFormat } from "@proto/orchestration_resource/v1/orchestration_resource_types_pb";
import {
  applyBindingResourcePlan,
  planResource,
  validateResource,
} from "@/lib/api/facade/orchestrationResource";
import { createResourceBindingDraft } from "./resource-binding-draft";
import { modelBindingNameForResourceId } from "./model-binding-resource-name";
import type { ResourceReference } from "./resource-editor-types";

export async function ensureModelBinding(
  orgSlug: string,
  resourceId: number,
  displayName: string,
): Promise<ResourceReference> {
  const name = modelBindingNameForResourceId(resourceId);
  const draft = createResourceBindingDraft("ModelBinding", orgSlug);
  draft.metadata.name = name;
  draft.metadata.displayName = displayName || name;
  draft.spec = { resourceId };

  const document = {
    format: SourceFormat.JSON,
    content: JSON.stringify(draft),
  };
  const validated = await validateResource(orgSlug, document);
  rejectBlocking("Validate", validated.issues);
  const planned = await planResource(orgSlug, document);
  rejectBlocking("Plan", planned.issues);
  const planId = planned.plan?.planId;
  if (!planId) {
    throw new Error("ModelBinding planning did not return a plan ID.");
  }
  const applied = await applyBindingResourcePlan(orgSlug, planId);
  return {
    kind: "ModelBinding",
    name,
    revision: Number(applied.revision),
  };
}

function rejectBlocking(
  stage: string,
  issues: ReadonlyArray<{ severity: IssueSeverity; message: string }> = [],
) {
  const blocking = issues.filter(
    (issue) => issue.severity === IssueSeverity.BLOCKING,
  );
  if (blocking.length === 0) return;
  throw new Error(
    `${stage} blocked: ${blocking.map((issue) => issue.message).join("; ")}`,
  );
}
