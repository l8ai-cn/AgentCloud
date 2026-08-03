import { relayPool } from "@/stores/workspace";
import { isPodNotConnectable, isResourceNotFound } from "@/lib/errors/serviceError";

// AgentPanel owns the control overlay independently of whether TerminalSurface
// has mounted yet. Without this subscription the lease button stays disabled
// forever on PTY pods that used to get their relay attach from TerminalPane.
export function subscribePodWorkbenchControlRelay(
  podKey: string,
  subscriptionId: string,
): () => void {
  void relayPool.subscribe(podKey, subscriptionId, () => undefined).catch(
    (error: unknown) => {
      if (isResourceNotFound(error) || isPodNotConnectable(error)) return;
      console.error("workbench control relay subscribe failed:", error);
    },
  );
  return () => {
    relayPool.unsubscribe(podKey, subscriptionId);
  };
}
