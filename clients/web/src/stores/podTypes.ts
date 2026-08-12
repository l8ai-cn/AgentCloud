import type { StoreApi } from "zustand";
import type { PodData } from "@/lib/api";
import { ACTIVE_POD_STATUSES, FINISHED_POD_STATUSES } from "@/lib/pod-status";

export type Pod = PodData;

// The two sidebar tabs are the two halves of the lifecycle — still working vs
// nothing more will happen. Derived from the generated groups so a new status
// can't land in neither tab (a queued Worker used to vanish this way).
export const SIDEBAR_STATUS_MAP: Record<string, string> = {
  running: ACTIVE_POD_STATUSES.join(","),
  stopped: FINISHED_POD_STATUSES.join(","),
};
export const SIDEBAR_PAGE_SIZE = 20;

export interface PodInitProgress {
  phase: string;
  progress: number;
  message: string;
}

export interface PodState {
  _tick: number;
  loading: boolean;
  error: string | null;
  initProgress: Record<string, PodInitProgress>;
  podTotal: number;
  podHasMore: boolean;
  loadingMore: boolean;
  currentSidebarFilter: string;
  sidebarLoadedCount: number;

  fetchPods: (filters?: { status?: string; runnerId?: number }) => Promise<void>;
  fetchPod: (podKey: string) => Promise<void>;
  fetchSidebarPods: (statusFilter: string, opts?: { silent?: boolean }) => Promise<void>;
  loadMorePods: () => Promise<void>;
  wakePod: (podKey: string) => Promise<Pod>;
  terminatePod: (podKey: string) => Promise<void>;
  deleteTerminalPod: (podKey: string) => Promise<void>;
  setCurrentPod: (pod: Pod | null) => void;
  updatePodStatus: (podKey: string, status: Pod["status"], agentStatus?: string, errorCode?: string, errorMessage?: string) => void;
  updateAgentStatus: (podKey: string, agentStatus: string) => void;
  updatePodTitle: (podKey: string, title: string) => void;
  updatePodAlias: (podKey: string, alias: string | null) => Promise<void>;
  updatePodAliasFromEvent: (podKey: string, alias: string | null) => void;
  updatePodPerpetual: (podKey: string, perpetual: boolean) => Promise<void>;
  updatePodPerpetualFromEvent: (podKey: string, perpetual: boolean) => void;
  upsertPod: (pod: Pod) => void;
  updatePodInitProgress: (podKey: string, phase: string, progress: number, message: string) => void;
  clearInitProgress: (podKey: string) => void;
  clearError: () => void;
}

// Action groups are built by factories in the pod*Actions modules so the store
// file stays a composition root instead of a 400-line god object.
export type PodSet = StoreApi<PodState>["setState"];
export type PodGet = StoreApi<PodState>["getState"];
