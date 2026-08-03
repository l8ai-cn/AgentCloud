import { useEffect } from "react";
import { relayPool } from "@/stores/relayConnection";
import { dispatchLoopalRelayEvent } from "@/stores/loopalDispatcher";
import { dispatchDoAgentRelayEvent } from "@/stores/doagentDispatcher";
import { usePodRelaySubscription } from "./usePodRelaySubscription";

// Conversation state comes from the workbench session API; this channel exists
// only for loopal/do-agent control verbs, which the session API does not model.
export function useDomainControlRelay(
  podKey: string,
  paneId: string,
  active: boolean,
): void {
  // Registered before the subscription effect so a synchronously delivered
  // event cannot land before the listener exists.
  useEffect(() => {
    if (!active) return;
    return relayPool.onAcpMessage(podKey, (msgType, payload) => {
      dispatchDoAgentRelayEvent(podKey, msgType, payload);
      dispatchLoopalRelayEvent(podKey, msgType, payload);
    });
  }, [podKey, active]);

  usePodRelaySubscription(podKey, `domain-control-${paneId}`, active);
}
