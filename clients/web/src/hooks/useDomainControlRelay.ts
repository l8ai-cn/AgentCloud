import { useEffect } from "react";
import { relayPool } from "@/stores/relayConnection";
import { dispatchLoopalRelayEvent } from "@/stores/loopalDispatcher";
import { dispatchDoAgentRelayEvent } from "@/stores/doagentDispatcher";
import { isResourceNotFound, isPodNotConnectable } from "@/lib/errors/serviceError";

// Conversation state comes from the workbench session API; this channel exists
// only for loopal/do-agent control verbs, which the session API does not model.
export function useDomainControlRelay(
  podKey: string,
  paneId: string,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;

    const subscriptionId = `domain-control-${paneId}`;
    const unsubscribeMessages = relayPool.onAcpMessage(
      podKey,
      (msgType, payload) => {
        dispatchDoAgentRelayEvent(podKey, msgType, payload);
        dispatchLoopalRelayEvent(podKey, msgType, payload);
      },
    );

    // Subscribe to share the WebSocket; terminal output is irrelevant here.
    // subscribe() is async — handle its rejection (mirrors useTerminalConnection)
    // so a connection-setup failure never escapes as an unhandled rejection.
    // not-found / not-yet-connectable are benign lifecycle transients (the
    // `active` dep re-runs this effect when pod status changes); only surface a
    // genuine connection failure.
    relayPool.subscribe(podKey, subscriptionId, () => {}).catch((error: unknown) => {
      if (isResourceNotFound(error) || isPodNotConnectable(error)) return;
      console.error("domain control relay subscribe failed:", error);
    });

    return () => {
      relayPool.unsubscribe(podKey, subscriptionId);
      unsubscribeMessages();
    };
  }, [podKey, paneId, active]);
}
