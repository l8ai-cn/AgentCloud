import { fromBinary } from "@bufbuild/protobuf";
import { ListPodsResponseSchema } from "@proto/pod/v1/pod_pb";
import { listPodsRaw } from "@/lib/api/facade/podConnect";
import { getErrorMessage } from "@/lib/utils";
import { initWasmCore, getPodState } from "@/lib/wasm-core";
import { readCurrentOrg } from "@/stores/auth";
import {
  SIDEBAR_PAGE_SIZE,
  SIDEBAR_STATUS_MAP,
  type PodGet,
  type PodSet,
  type PodState,
} from "./podTypes";

type SidebarActions = Pick<PodState, "fetchSidebarPods" | "loadMorePods">;

// Monotonic id so an out-of-order sidebar fetch can't clobber a newer one. Both
// the cold-load (non-silent) and reconnect/manual (silent) paths bump it on
// entry; a response whose id is no longer the latest is discarded before it
// writes the cache/total. sidebarLoadingSeq tracks the latest NON-silent call
// (the spinner's owner) separately, so a superseding silent refresh — which
// never touches loading — can't strand a stale non-silent call's spinner.
let sidebarRequestSeq = 0;
let sidebarLoadingSeq = 0;

export function createPodSidebarActions(set: PodSet, get: PodGet): SidebarActions {
  const orgSlug = () => readCurrentOrg()?.slug ?? "";

  return {
    fetchSidebarPods: async (statusFilter, opts) => {
      const silent = opts?.silent ?? false;
      const mySeq = ++sidebarRequestSeq;
      if (!silent) sidebarLoadingSeq = mySeq;
      await initWasmCore();
      if (!silent) set({ error: null, currentSidebarFilter: statusFilter, loading: true });
      try {
        const respBytes = await listPodsRaw(orgSlug(), {
          status: SIDEBAR_STATUS_MAP[statusFilter],
          limit: SIDEBAR_PAGE_SIZE, offset: 0,
        });
        // Decode once for the pagination counters; the same bytes feed the cache.
        const resp = fromBinary(ListPodsResponseSchema, respBytes);
        const total = Number(resp.total);
        const pageLen = resp.items.length;
        // Write cache + counters only while this is still the latest request for
        // the active filter: a tab switch or a newer fetch must not be clobbered.
        if (get().currentSidebarFilter === statusFilter && sidebarRequestSeq === mySeq) {
          getPodState().apply_fetched_pods(respBytes);
          set({
            podTotal: total, podHasMore: pageLen < total,
            sidebarLoadedCount: pageLen, _tick: get()._tick + 1,
          });
        }
      } catch (error: unknown) {
        if (!silent) set({ error: getErrorMessage(error, "Failed to fetch pods") });
      } finally {
        // Decoupled from the seq/data guard above so a superseding SILENT
        // refresh can't leave loading stuck true.
        if (!silent && sidebarLoadingSeq === mySeq) set({ loading: false });
      }
    },

    loadMorePods: async () => {
      const { podHasMore, loadingMore, currentSidebarFilter, sidebarLoadedCount } = get();
      if (!podHasMore || loadingMore) return;
      // Baseline seq (loadMore appends, it doesn't bump): if a fetchSidebarPods
      // replaces the cache + resets the offset mid-flight, our page would append
      // at a stale offset (gap/duplicate rows), so discard it then.
      const mySeq = sidebarRequestSeq;
      set({ loadingMore: true });
      await initWasmCore();
      try {
        // Page from how many we've actually pulled for THIS filter, not the cache
        // length: realtime insert_created_pod upserts org-wide pods (incl. ones the
        // active filter hides) into the shared cache, so cache length drifts from
        // the server's filtered offset and would skip or duplicate rows.
        const respBytes = await listPodsRaw(orgSlug(), {
          status: SIDEBAR_STATUS_MAP[currentSidebarFilter],
          limit: SIDEBAR_PAGE_SIZE, offset: sidebarLoadedCount,
        });
        const resp = fromBinary(ListPodsResponseSchema, respBytes);
        const total = Number(resp.total);
        const pageLen = resp.items.length;
        // Discard if superseded: filter changed, a newer fetch bumped the seq, or
        // a fetchSidebarPods already in flight when we started reset the offset
        // (same seq baseline, so the seq check alone misses it — catch it via the
        // loaded-count change).
        if (get().currentSidebarFilter !== currentSidebarFilter
            || sidebarRequestSeq !== mySeq
            || get().sidebarLoadedCount !== sidebarLoadedCount) {
          set({ loadingMore: false });
          return;
        }
        getPodState().apply_appended_pods(respBytes);
        const loaded = sidebarLoadedCount + pageLen;
        set({
          podTotal: total, podHasMore: loaded < total,
          loadingMore: false, sidebarLoadedCount: loaded, _tick: get()._tick + 1,
        });
      } catch (error: unknown) {
        set({ error: getErrorMessage(error, "Failed to load more pods"), loadingMore: false });
      }
    },
  };
}
