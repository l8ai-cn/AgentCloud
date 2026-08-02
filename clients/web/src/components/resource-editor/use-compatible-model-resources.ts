"use client";

import { useEffect, useState } from "react";
import {
  modelResourceLabel,
  type WorkerModelResourceRequirement,
} from "@/components/pod/CreatePodForm/workerModelResources";
import { loadCompatibleModelResources } from "@/components/pod/CreatePodForm/loadCompatibleModelResources";

export interface CompatibleModelResourceOption {
  resourceId: number;
  label: string;
  selectable: boolean;
  blockingReason: string;
}

interface CompatibleModelResourcesState {
  loading: boolean;
  error: string | null;
  options: CompatibleModelResourceOption[];
}

export function useCompatibleModelResources(
  orgSlug: string,
  requirement: WorkerModelResourceRequirement,
): CompatibleModelResourcesState {
  const adaptersKey = requirement.protocolAdapters.slice().sort().join(",");
  const requestKey = `${orgSlug}:${requirement.required}:${adaptersKey}`;
  const [state, setState] = useState<CompatibleModelResourcesState>({
    loading: true,
    error: null,
    options: [],
  });
  const [loadedKey, setLoadedKey] = useState(requestKey);

  if (loadedKey !== requestKey) {
    setLoadedKey(requestKey);
    setState({ loading: true, error: null, options: [] });
  }

  useEffect(() => {
    let active = true;
    void loadCompatibleModelResources({
      orgSlug,
      requirement: {
        required: requirement.required,
        protocolAdapters: adaptersKey ? adaptersKey.split(",") : [],
      },
    }).then((resources) => {
      if (!active) return;
      setState({
        loading: false,
        error: null,
        options: resources.flatMap((item) => {
          const resourceId = item.resource?.id;
          if (!resourceId) return [];
          return [{
            resourceId,
            label: modelResourceLabel(item),
            selectable: item.selectable,
            blockingReason: item.blockingReason,
          }];
        }),
      });
    }).catch((error: unknown) => {
      if (!active) return;
      setState({
        loading: false,
        error: error instanceof Error
          ? error.message
          : "Failed to load model resources.",
        options: [],
      });
    });
    return () => {
      active = false;
    };
  }, [adaptersKey, orgSlug, requirement.required, requestKey]);

  return state;
}
