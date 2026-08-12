import { SIDEBAR_STATUS_MAP } from "./podTypes";
import type { Pod } from "./podTypes";

// The pod cache is org-wide (realtime upserts land there regardless of the
// active tab), so the sidebar re-applies the tab's status filter locally on top
// of the server-side one. Same map both sides, or a Worker shows up in the
// wrong tab — or in neither.
export function filterSidebarPods(pods: Pod[], filter: string, searchQuery: string): Pod[] {
  const allowedStatuses = SIDEBAR_STATUS_MAP[filter];
  const statusSet = allowedStatuses ? new Set(allowedStatuses.split(",")) : null;
  const query = searchQuery.trim().toLowerCase();

  return pods.filter((pod) => {
    if (statusSet && !statusSet.has(pod.status)) return false;
    if (!query) return true;
    return pod.pod_key.toLowerCase().includes(query)
      || !!pod.ticket?.slug?.toLowerCase().includes(query)
      || !!pod.runner?.node_id?.toLowerCase().includes(query);
  });
}
