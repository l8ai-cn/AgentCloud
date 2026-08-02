import { useEffect, useState } from "react";
import type { EffectiveResource } from "@/lib/api/facade/aiResource";
import {
  listOrganizationEffectiveResources,
  listPersonalEffectiveResources,
} from "@/lib/api/facade/aiResourceConnect";
import { readCurrentOrg } from "@/stores/auth";
import { loadCompatibleModelResources } from "../CreatePodForm/loadCompatibleModelResources";
import type { WorkerModelResourceRequirement } from "../CreatePodForm/workerModelResources";

export function useWorkerModelResources(
  agentSlug: string | null | undefined,
  initialModelResourceId: number | null = null,
  includeToolModels = false,
  requirement?: WorkerModelResourceRequirement,
) {
  const [resources, setResources] = useState<EffectiveResource[]>([]);
  const [toolResources, setToolResources] = useState<EffectiveResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAgentSlug, setLoadedAgentSlug] = useState("");
  const [selectedModelResourceId, setSelectedModelResourceId] = useState<
    number | null
  >(null);
  const requestAgentSlug = agentSlug ?? "";
  const modelRequired = requirement?.required ?? false;
  const protocolAdapterKey = requirement?.protocolAdapters.join(",") ?? "";

  useEffect(() => {
    setSelectedModelResourceId(initialModelResourceId);
    if (!modelRequired) {
      setResources([]);
      setToolResources([]);
      setError(null);
      setLoading(false);
      setLoadedAgentSlug(requestAgentSlug);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const orgSlug = readCurrentOrg()?.slug ?? "";
        const modalities = includeToolModels ? ["chat", "video"] : ["chat"];
        const [compatible, toolPool] = await Promise.all([
          loadCompatibleModelResources({
            orgSlug: orgSlug || undefined,
            modalities,
            requirement: {
              required: true,
              protocolAdapters: protocolAdapterKey
                ? protocolAdapterKey.split(",")
                : [],
            },
          }),
          includeToolModels
            ? (orgSlug
              ? listOrganizationEffectiveResources(orgSlug, modalities)
              : listPersonalEffectiveResources(modalities))
            : Promise.resolve([] as EffectiveResource[]),
        ]);
        if (cancelled) return;
        setResources(compatible);
        setToolResources(includeToolModels ? dedupeResources(toolPool) : []);
      } catch (err) {
        if (cancelled) return;
        setResources([]);
        setToolResources([]);
        setError(
          err instanceof Error ? err.message : "Failed to load model resources",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadedAgentSlug(requestAgentSlug);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    includeToolModels,
    initialModelResourceId,
    modelRequired,
    protocolAdapterKey,
    requestAgentSlug,
  ]);

  const current = loadedAgentSlug === requestAgentSlug;
  const visibleResources = current ? resources : [];
  const selectedModelResource = visibleResources.find(
    (item) => item.resource?.id === selectedModelResourceId,
  );

  return {
    modelResources: visibleResources,
    toolModelResources: current ? toolResources : [],
    loadingModelResources: modelRequired && (!current || loading),
    modelResourceError: current ? error : null,
    selectedModelResource,
    selectedModelResourceId,
    setSelectedModelResourceId,
  };
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
