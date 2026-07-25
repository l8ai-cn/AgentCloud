import type { EffectiveResource, ProviderDefinition } from "@/lib/api/facade/aiResource";
import type { WorkerToolModelRequirement } from "@/lib/api/facade/podConnect";

export interface WorkerModelResourceRequirement {
  required: boolean;
  protocolAdapters: string[];
}

// The backend worker definition (WorkerTypeOption.requires_model_resource /
// model_protocol_adapters) is authoritative; `requirement` must come from the
// create-options response or the generated worker catalog, never from a
// frontend-side agent table.
export function compatibleModelResources(
  resources: EffectiveResource[],
  providers: ProviderDefinition[],
  requirement: WorkerModelResourceRequirement,
): EffectiveResource[] {
  if (!requirement.required) return [];
  const protocolByProvider = new Map(providers.map((p) => [p.key, p.protocolAdapter]));
  return resources.filter((item) => {
    const providerKey = item.connection?.providerKey;
    const protocol = providerKey ? protocolByProvider.get(providerKey) : undefined;
    return Boolean(
      item.selectable &&
        item.connection?.isEnabled &&
        item.resource?.isEnabled &&
        item.resource.modalities.includes("chat") &&
        item.resource.capabilities.includes("text-generation") &&
        protocol &&
        requirement.protocolAdapters.includes(protocol),
    );
  });
}

export function compatibleToolModelResources(
  requirement: WorkerToolModelRequirement,
  resources: EffectiveResource[],
): EffectiveResource[] {
  return resources.filter((item) => {
    const providerKey = item.connection?.providerKey;
    return Boolean(
      item.selectable &&
        item.connection?.isEnabled &&
        item.resource?.isEnabled &&
        providerKey &&
        requirement.provider_keys.includes(providerKey) &&
        item.resource.modalities.includes(requirement.modality) &&
        item.resource.capabilities.includes(requirement.capability) &&
        matchesToolModelFamily(requirement, providerKey, item.resource.modelId),
    );
  });
}

function matchesToolModelFamily(
  requirement: WorkerToolModelRequirement,
  providerKey: string,
  modelId: string,
): boolean {
  if (requirement.capability !== "video-generation") return true;
  if (providerKey === "doubao") {
    return modelId.trim().startsWith("doubao-seedance-");
  }
  if (providerKey === "sub2api-seedance") {
    return modelId.trim() === "doubao-seedance-2-0-260128";
  }
  return true;
}

export function modelResourceLabel(resource: EffectiveResource): string {
  const model = resource.resource;
  const connection = resource.connection;
  const name = model?.displayName || model?.modelId || model?.identifier || "";
  if (!connection?.name) return name;
  return `${connection.name} · ${name}`;
}

export function toolModelRoleLabel(role: string): string {
  const words = role.split("-").filter(Boolean);
  if (words.length === 0) return role;
  return [capitalize(words[0]), ...words.slice(1)].join(" ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
