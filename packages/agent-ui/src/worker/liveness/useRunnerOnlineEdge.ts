import { useEffect, useRef } from "react";

/** Fire once on each false/undefined → true edge (runner reconnect). */
export function useRunnerOnlineEdge(
  online: boolean | undefined,
  refresh: () => void,
): void {
  const prev = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (online === true && prev.current !== true) refresh();
    prev.current = online;
  }, [online, refresh]);
}
