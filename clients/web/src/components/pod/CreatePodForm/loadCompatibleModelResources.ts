import {
  getCatalog,
  listOrganizationEffectiveResources,
  listPersonalEffectiveResources,
} from "@/lib/api/facade/aiResourceConnect";
import type { EffectiveResource } from "@/lib/api/facade/aiResource";
import {
  compatibleModelResources,
  type WorkerModelResourceRequirement,
} from "./workerModelResources";

export async function loadCompatibleModelResources(input: {
  orgSlug?: string;
  modalities?: string[];
  requirement: WorkerModelResourceRequirement;
}): Promise<EffectiveResource[]> {
  const modalities = input.modalities ?? ["chat"];
  const [catalog, effective] = await Promise.all([
    getCatalog(),
    input.orgSlug
      ? listOrganizationEffectiveResources(input.orgSlug, modalities)
      : listPersonalEffectiveResources(modalities),
  ]);
  const deduped = dedupeResources(effective);
  if (
    input.requirement.required &&
    input.requirement.protocolAdapters.length > 0
  ) {
    return compatibleModelResources(deduped, catalog, input.requirement);
  }
  return selectableChatModels(deduped);
}

function selectableChatModels(
  resources: EffectiveResource[],
): EffectiveResource[] {
  return resources.filter((item) =>
    Boolean(
      item.selectable &&
        item.connection?.isEnabled &&
        item.resource?.isEnabled &&
        item.resource.modalities.includes("chat") &&
        item.resource.capabilities.includes("text-generation"),
    )
  );
}

function dedupeResources(items: EffectiveResource[]): EffectiveResource[] {
  const seen = new Set<number>();
  const out: EffectiveResource[] = [];
  for (const item of items) {
    const id = item.resource?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}
