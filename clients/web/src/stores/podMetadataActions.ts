import { create as protoCreate, toBinary } from "@bufbuild/protobuf";
import { PatchPodPerpetualRequestSchema } from "@proto/pod_state/v1/pod_state_pb";
import {
  updatePodAlias as updatePodAliasConnect,
  updatePodPerpetual as updatePodPerpetualConnect,
} from "@/lib/api/facade/podConnect";
import { getErrorMessage } from "@/lib/utils";
import { initWasmCore, getPodState } from "@/lib/wasm-core";
import { readCurrentOrg } from "@/stores/auth";
import {
  applyAgentStatusEvent,
  applyPodAliasEvent,
  applyPodStatusEvent,
  applyPodTitleEvent,
} from "./podStateEvents";
import type { PodSet, PodState } from "./podTypes";

type MetadataActions = Pick<
  PodState,
  | "updatePodStatus"
  | "updateAgentStatus"
  | "updatePodTitle"
  | "updatePodAlias"
  | "updatePodAliasFromEvent"
  | "updatePodPerpetual"
  | "updatePodPerpetualFromEvent"
>;

export function createPodMetadataActions(set: PodSet): MetadataActions {
  const orgSlug = () => readCurrentOrg()?.slug ?? "";
  const bump = () => set((s) => ({ _tick: s._tick + 1 }));

  const patchPerpetual = (podKey: string, perpetual: boolean) => {
    const req = protoCreate(PatchPodPerpetualRequestSchema, { podKey, perpetual });
    getPodState().patch_pod_perpetual(toBinary(PatchPodPerpetualRequestSchema, req));
    bump();
  };

  return {
    updatePodStatus: (podKey, status, agentStatus, errorCode, errorMessage) => {
      applyPodStatusEvent(podKey, status, agentStatus, errorCode, errorMessage);
      bump();
    },

    updateAgentStatus: (podKey, agentStatus) => {
      applyAgentStatusEvent(podKey, agentStatus);
      bump();
    },

    updatePodTitle: (podKey, title) => {
      applyPodTitleEvent(podKey, title);
      bump();
    },

    updatePodAliasFromEvent: (podKey, alias) => {
      applyPodAliasEvent(podKey, alias);
      bump();
    },

    updatePodAlias: async (podKey, alias) => {
      await initWasmCore();
      try {
        await updatePodAliasConnect(orgSlug(), podKey, alias);
        applyPodAliasEvent(podKey, alias);
        bump();
      } catch (error: unknown) {
        console.warn("[PodStore] updatePodAlias failed, reverting", error);
        bump();
        throw error;
      }
    },

    updatePodPerpetualFromEvent: patchPerpetual,

    updatePodPerpetual: async (podKey, perpetual) => {
      await initWasmCore();
      try {
        await updatePodPerpetualConnect(orgSlug(), podKey, perpetual);
        patchPerpetual(podKey, perpetual);
      } catch (error: unknown) {
        set({ error: getErrorMessage(error, "Failed to update perpetual") });
        throw error;
      }
    },
  };
}
