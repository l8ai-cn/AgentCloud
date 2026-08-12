import { create as protoCreate, toBinary } from "@bufbuild/protobuf";
import {
  InsertCreatedPodRequestSchema,
  MarkPodTerminatedRequestSchema,
} from "@proto/pod_state/v1/pod_state_pb";
import { ApiError } from "@/lib/api/api-types";
import {
  terminatePod as terminatePodConnect,
  wakePod as wakePodConnect,
} from "@/lib/api/facade/podConnect";
import { deleteTerminalPod as deleteTerminalPodRequest } from "@/lib/api/podDeletionApi";
import { podToProtoPod } from "@/lib/api/podProtoMap";
import { getErrorMessage } from "@/lib/utils";
import { initWasmCore, getPodState } from "@/lib/wasm-core";
import { readCurrentOrg } from "@/stores/auth";
import type { PodGet, PodSet, PodState } from "./podTypes";

type LifecycleActions = Pick<
  PodState,
  "wakePod" | "terminatePod" | "deleteTerminalPod" | "upsertPod"
>;

export function createPodLifecycleActions(set: PodSet, get: PodGet): LifecycleActions {
  const orgSlug = () => readCurrentOrg()?.slug ?? "";
  const bump = () => set((s) => ({ _tick: s._tick + 1 }));

  const upsertPod: PodState["upsertPod"] = (pod) => {
    const req = protoCreate(InsertCreatedPodRequestSchema, {
      pod: podToProtoPod(pod), clientTimestampMs: BigInt(Date.now()),
    });
    getPodState().insert_created_pod(toBinary(InsertCreatedPodRequestSchema, req));
    bump();
  };

  return {
    upsertPod,

    wakePod: async (podKey) => {
      await initWasmCore();
      try {
        const { pod } = await wakePodConnect(orgSlug(), podKey);
        upsertPod(pod);
        // Non-silent so currentSidebarFilter flips to Running — waking from the
        // Stopped tab (or TerminalPane) otherwise keeps a stopped client filter
        // and a silent stopped refetch can wipe the new pod from cache.
        await get().fetchSidebarPods("running");
        return pod;
      } catch (error: unknown) {
        set({ error: getErrorMessage(error, "Failed to wake pod") });
        throw error;
      }
    },

    terminatePod: async (podKey) => {
      try {
        await terminatePodConnect(orgSlug(), podKey);
        const req = protoCreate(MarkPodTerminatedRequestSchema, { podKey });
        getPodState().mark_pod_terminated(toBinary(MarkPodTerminatedRequestSchema, req));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        const isNotFound = (error instanceof ApiError && error.status === 404) || msg.includes("404");
        if (!isNotFound) {
          set({ error: getErrorMessage(error, "Failed to terminate pod") });
          throw error;
        }
      }
      bump();
    },

    deleteTerminalPod: async (podKey) => {
      try {
        await deleteTerminalPodRequest(podKey);
        await get().fetchSidebarPods(get().currentSidebarFilter);
      } catch (error: unknown) {
        set({ error: getErrorMessage(error, "Failed to delete pod") });
        throw error;
      }
    },
  };
}
