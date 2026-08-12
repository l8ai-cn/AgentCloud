import { create } from "zustand";
import { useMemo } from "react";
import { create as protoCreate, toBinary, fromBinary } from "@bufbuild/protobuf";
import { reconnectRegistry } from "@/lib/realtime";
import { readCurrentOrg } from "@/stores/auth";
import { getErrorMessage } from "@/lib/utils";
import { initWasmCore, getPodState } from "@/lib/wasm-core";
import { listPodsRaw, getPod as getPodConnect } from "@/lib/api/facade/podConnect";
import { fromProtoPod, podToProtoPod } from "@/lib/api/podProtoMap";
import { PodSchema } from "@proto/pod/v1/pod_pb";
import {
  ReplaceCachedPodsRequestSchema,
  InsertCreatedPodRequestSchema,
} from "@proto/pod_state/v1/pod_state_pb";
import { createPodLifecycleActions } from "./podLifecycleActions";
import { createPodMetadataActions } from "./podMetadataActions";
import { createPodSidebarActions } from "./podSidebarActions";
import type { PodState, Pod } from "./podTypes";

export type { Pod } from "./podTypes";
export { SIDEBAR_STATUS_MAP } from "./podTypes";
export * from "./podStateEvents";

// Read side, zero-JSON: decode state proto bytes via fromBinary + podToCache
// (re-exported as fromProtoPod), so the UI is a projection of state proto bytes.
export function usePods(): Pod[] {
  const tick = usePodStore((s) => s._tick);
  return useMemo(
    () => fromBinary(ReplaceCachedPodsRequestSchema, getPodState().pods_bytes()).pods.map(fromProtoPod) as Pod[],
    [tick],
  );
}

export function usePod(podKey: string | undefined): Pod | undefined {
  const tick = usePodStore((s) => s._tick);
  return useMemo(() => {
    if (!podKey) return undefined;
    const bytes = getPodState().get_pod_bytes(podKey);
    if (bytes.length === 0) return undefined;
    return fromProtoPod(fromBinary(PodSchema, bytes)) as Pod;
  }, [tick, podKey]);
}

export function useCurrentPod(): Pod | null {
  const tick = usePodStore((s) => s._tick);
  return useMemo(() => {
    const bytes = getPodState().current_pod_bytes();
    if (bytes.length === 0) return null;
    return fromProtoPod(fromBinary(PodSchema, bytes)) as Pod;
  }, [tick]);
}

const fetchPodInflight = new Map<string, Promise<void>>();

export const usePodStore = create<PodState>((set, get) => ({
  _tick: 0, loading: false, error: null, initProgress: {},
  podTotal: 0, podHasMore: false, loadingMore: false, currentSidebarFilter: "running", sidebarLoadedCount: 0,

  ...createPodSidebarActions(set, get),
  ...createPodLifecycleActions(set, get),
  ...createPodMetadataActions(set),

  fetchPods: async (filters) => {
    await initWasmCore();
    set({ error: null });
    try {
      const respBytes = await listPodsRaw(readCurrentOrg()?.slug ?? "", { status: filters?.status });
      getPodState().apply_fetched_pods(respBytes);
      set((s) => ({ _tick: s._tick + 1 }));
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, "Failed to fetch pods") });
    }
  },

  fetchPod: async (podKey) => {
    const inflight = fetchPodInflight.get(podKey);
    if (inflight) return inflight;
    const promise = (async () => {
      await initWasmCore();
      try {
        const slug = readCurrentOrg()?.slug ?? "";
        if (!slug) {
          throw new Error("Organization not ready");
        }
        const pod = await getPodConnect(slug, podKey);
        const req = protoCreate(InsertCreatedPodRequestSchema, {
          pod: podToProtoPod(pod), clientTimestampMs: BigInt(Date.now()),
        });
        getPodState().insert_created_pod(toBinary(InsertCreatedPodRequestSchema, req));
        set((s) => ({ _tick: s._tick + 1 }));
      } catch (error: unknown) {
        console.warn("[PodStore] fetchPod failed for", podKey, error);
        throw error;
      } finally { fetchPodInflight.delete(podKey); }
    })();
    fetchPodInflight.set(podKey, promise);
    return promise;
  },

  // Note: set_current_pod removed — no production caller. Method kept on
  // PodState interface for now to satisfy the typed registry shape.
  setCurrentPod: (_pod) => { set((s) => ({ _tick: s._tick + 1 })); },

  updatePodInitProgress: (podKey, phase, progress, message) => {
    set((state) => ({ initProgress: { ...state.initProgress, [podKey]: { phase, progress, message } } }));
  },

  clearInitProgress: (podKey) => {
    set((state) => {
      const { [podKey]: _removed, ...rest } = state.initProgress;
      return { initProgress: rest };
    });
  },

  clearError: () => set({ error: null }),
}));

reconnectRegistry.register({
  name: "pod:sidebar",
  fn: () => {
    const s = usePodStore.getState();
    s.fetchSidebarPods?.(s.currentSidebarFilter, { silent: true });
  },
  priority: "immediate",
});
