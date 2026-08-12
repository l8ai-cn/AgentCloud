import { create as protoCreate, toBinary } from "@bufbuild/protobuf";
import {
  ApplyAgentStatusEventRequestSchema,
  ApplyPodAliasEventRequestSchema,
  ApplyPodStatusEventRequestSchema,
  ApplyPodTitleEventRequestSchema,
} from "@proto/pod_state/v1/pod_state_pb";
import { getPodState } from "@/lib/wasm-core";

export function applyPodStatusEvent(
  podKey: string, status: string,
  agentStatus?: string | null, errorCode?: string | null, errorMessage?: string | null,
) {
  const req = protoCreate(ApplyPodStatusEventRequestSchema, {
    podKey, status,
    agentStatus: agentStatus ?? undefined,
    errorCode: errorCode ?? undefined,
    errorMessage: errorMessage ?? undefined,
  });
  getPodState().apply_pod_status_event(toBinary(ApplyPodStatusEventRequestSchema, req));
}

export function applyPodTitleEvent(podKey: string, title: string) {
  const req = protoCreate(ApplyPodTitleEventRequestSchema, { podKey, title });
  getPodState().apply_pod_title_event(toBinary(ApplyPodTitleEventRequestSchema, req));
}

export function applyPodAliasEvent(podKey: string, alias: string | null) {
  const req = protoCreate(ApplyPodAliasEventRequestSchema, {
    podKey, alias: alias ?? undefined,
  });
  getPodState().apply_pod_alias_event(toBinary(ApplyPodAliasEventRequestSchema, req));
}

export function applyAgentStatusEvent(podKey: string, agentStatus: string) {
  const req = protoCreate(ApplyAgentStatusEventRequestSchema, { podKey, agentStatus });
  getPodState().apply_agent_status_event(toBinary(ApplyAgentStatusEventRequestSchema, req));
}
