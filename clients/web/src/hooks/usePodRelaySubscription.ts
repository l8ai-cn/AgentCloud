import { useEffect } from "react";
import { relayPool } from "@/stores/relayConnection";
import { isResourceNotFound, isPodNotConnectable } from "@/lib/errors/serviceError";

// The control lease lives on the relay socket, so any surface that lets a user
// drive a worker must hold a subscription — even when it reads conversation
// state from the workbench session API and ignores terminal output.
export function usePodRelaySubscription(
  podKey: string,
  subscriptionId: string,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;

    // not-found / not-yet-connectable are benign lifecycle transients (`active`
    // re-runs this effect when pod status changes); only surface real failures.
    relayPool.subscribe(podKey, subscriptionId, () => {}).catch((error: unknown) => {
      if (isResourceNotFound(error) || isPodNotConnectable(error)) return;
      console.error("pod relay subscribe failed:", error);
    });

    return () => relayPool.unsubscribe(podKey, subscriptionId);
  }, [podKey, subscriptionId, active]);
}
