import { useEffect, useRef, useState } from "react";

import type { AgentSessionRuntime } from "../../agentSessionRuntime";
import type { WorkerClient } from "../WorkerClient";
import { refKey, type WorkerRef } from "../contracts";
import {
  isWorkerSessionReadable,
  type WorkerLiveness,
} from "../liveness/workerLiveness";

export function useWorkerLiveness(
  client: WorkerClient,
  workerRef: WorkerRef,
): WorkerLiveness {
  const [liveness, setLiveness] = useState<WorkerLiveness>({
    state: "unknown",
  });
  const key = refKey(workerRef);
  const refHolder = useRef(workerRef);
  refHolder.current = workerRef;

  useEffect(() => {
    const transport = client.transportFor(refHolder.current);
    return transport.subscribeLiveness(refHolder.current, setLiveness);
  }, [client, key]);

  return liveness;
}

export function useWorkerSessionId(
  client: WorkerClient,
  workerRef: WorkerRef,
  liveness: WorkerLiveness,
): { sessionId: string | null; resolveError: string | null } {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const readable = isWorkerSessionReadable(liveness);
  const key = refKey(workerRef);
  const refHolder = useRef(workerRef);
  refHolder.current = workerRef;

  useEffect(() => {
    if (!readable) {
      setSessionId((prev) => {
        if (prev) client.release(prev);
        return null;
      });
      setResolveError(null);
      return;
    }

    let active = true;
    const currentRef = refHolder.current;
    setResolveError(null);
    void client.resolveSession(currentRef).then(
      (id) => {
        if (active) setSessionId(id);
      },
      (error: unknown) => {
        if (!active) return;
        setSessionId(null);
        setResolveError(
          error instanceof Error ? error.message : "Failed to resolve session",
        );
      },
    );

    return () => {
      active = false;
    };
  }, [client, readable, key]);

  useEffect(() => {
    return () => {
      if (sessionId) client.release(sessionId);
    };
  }, [client, sessionId]);

  return { sessionId, resolveError };
}

export function useWorkerRuntime(
  client: WorkerClient,
  workerRef: WorkerRef,
  sessionId: string | null,
  liveness: WorkerLiveness,
): AgentSessionRuntime | null {
  const [runtime, setRuntime] = useState<AgentSessionRuntime | null>(null);
  const key = refKey(workerRef);
  const refHolder = useRef(workerRef);
  refHolder.current = workerRef;

  const livenessKey =
    liveness.state === "online"
      ? `online:${liveness.readOnly ?? ""}`
      : liveness.state;

  useEffect(() => {
    if (!sessionId || !isWorkerSessionReadable(liveness)) {
      setRuntime(null);
      return;
    }
    const next = client.runtimeFor(refHolder.current, sessionId);
    setRuntime(next);
    void next.open(sessionId).catch(() => undefined);
  }, [client, sessionId, livenessKey, key]);

  return runtime;
}
