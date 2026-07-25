import workerRuntimeCatalog from "@/generated/worker-runtime-catalog.json";
import { lightConnect } from "@/lib/light-auth/api-fetch";

const AI_RESOURCE_SERVICE = "proto.ai_resource.v1.AIResourceService";

interface WorkerModelRequirement {
  required: boolean;
  protocol_adapters: string[];
}

export function workerModelRequirement(agentSlug: string): WorkerModelRequirement | null {
  const worker = workerRuntimeCatalog.workers.find((item) => item.slug === agentSlug);
  return (worker as { modelRequirement?: WorkerModelRequirement } | undefined)
    ?.modelRequirement ?? null;
}

/** `null` when the generated catalog has no entry — safe for render paths. */
export function marketplaceWorkerRequiresModelResource(
  agentSlug: string,
): boolean | null {
  const requirement = workerModelRequirement(agentSlug);
  if (!requirement) return null;
  return requirement.required;
}

interface CatalogResponse {
  providers?: Array<{ key?: string; protocolAdapter?: string }>;
}

interface EffectiveResourcesResponse {
  resources?: Array<{
    selectable?: boolean;
    connection?: {
      providerKey?: string;
      name?: string;
      isEnabled?: boolean;
    };
    resource?: {
      id?: string | number;
      displayName?: string;
      modelId?: string;
      isEnabled?: boolean;
      modalities?: string[];
      capabilities?: string[];
    };
  }>;
}

export interface MarketplaceModelResource {
  id: number;
  label: string;
}

const inFlightRequests = new Map<
  string,
  Promise<MarketplaceModelResource[]>
>();

export async function listMarketplaceModelResources(
  orgSlug: string,
  agentSlug: string,
): Promise<MarketplaceModelResource[]> {
  const key = `${orgSlug}\u0000${agentSlug}`;
  const existing = inFlightRequests.get(key);
  if (existing) return existing;
  const request = loadMarketplaceModelResources(orgSlug, agentSlug);
  inFlightRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlightRequests.get(key) === request) {
      inFlightRequests.delete(key);
    }
  }
}

async function loadMarketplaceModelResources(
  orgSlug: string,
  agentSlug: string,
): Promise<MarketplaceModelResource[]> {
  const requirement = workerModelRequirement(agentSlug);
  if (!requirement) throw new Error(`worker model requirement not found: ${agentSlug}`);
  if (!requirement.required) return [];
  const [catalog, effective] = await Promise.all([
    lightConnect<Record<string, never>, CatalogResponse>(
      AI_RESOURCE_SERVICE,
      "GetCatalog",
      {},
      { authenticated: true },
    ),
    lightConnect<
      { orgSlug: string; modalities: string[] },
      EffectiveResourcesResponse
    >(
      AI_RESOURCE_SERVICE,
      "ListOrganizationEffectiveResources",
      { orgSlug, modalities: ["chat"] },
      { authenticated: true },
    ),
  ]);
  const protocols = new Map(
    (catalog.providers ?? []).map((provider) => [
      provider.key ?? "",
      provider.protocolAdapter ?? "",
    ]),
  );
  return (effective.resources ?? []).flatMap((item) => {
    const connection = item.connection;
    const resource = item.resource;
    const protocol = protocols.get(connection?.providerKey ?? "") ?? "";
    if (
      !item.selectable ||
      connection?.isEnabled === false ||
      !resource?.isEnabled ||
      !resource.modalities?.includes("chat") ||
      !resource.capabilities?.includes("text-generation") ||
      !requirement.protocol_adapters.includes(protocol)
    ) {
      return [];
    }
    const id = Number(resource.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("unsafe model resource id");
    }
    const name = resource.displayName || resource.modelId || String(resource.id);
    const label = connection?.name ? `${connection.name} · ${name}` : name;
    return [{ id, label }];
  });
}
