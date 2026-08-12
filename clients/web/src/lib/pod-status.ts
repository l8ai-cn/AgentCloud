// Pod lifecycle vocabulary and classification are generated from
// proto/pod/v1/pod_status.proto (see tools/pod-status-codegen) and shipped in
// the contract package. Re-exported here so web keeps one import path and
// cannot grow a second, drifting definition.
export {
  ACTIVE_POD_STATUSES,
  FINISHED_POD_STATUSES,
  POD_STATUSES,
  RELAY_CONNECTABLE_POD_STATUSES,
  RESUMABLE_SOURCE_POD_STATUSES,
  TERMINAL_POD_STATUSES,
  isPodActive,
  isPodFinished,
  isPodRelayConnectable,
  isPodResumableSource,
  isPodTerminal,
  type PodStatus,
} from "@agent-cloud/service-interface";
