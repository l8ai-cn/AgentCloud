import { useEffect, useId, useMemo, useRef } from "react";
import { WorkerClient, type AgentSessionRuntime } from "@agent-cloud/agent-ui";

import { usePodRelaySubscription } from "@/hooks/usePodRelaySubscription";
import { useWorkerControlLease } from "@/hooks/useWorkerControlLease";
import { usePod, usePodStore } from "@/stores/pod";
import { createPodWorkerTransport } from "./podWorkerTransport";
import { PodTerminalRuntime } from "./PodTerminalRuntime";
import { subscribePodWorkbenchControlRelay } from "./podWorkbenchControlRelay";
import { usePodWorkspaceArtifacts } from "./usePodWorkspaceArtifacts";

export type PodRuntimeDecorator = (
  runtime: AgentSessionRuntime,
  podKey: string,
) => AgentSessionRuntime;

export function usePodWorkerSession(
  podKey: string,
  controlClientLabel: string,
  decorateRuntime?: PodRuntimeDecorator,
) {
  const pod = usePod(podKey);
  const controlLease = useWorkerControlLease(podKey, controlClientLabel);
  const podStatus = pod?.status ?? "unknown";
  const liveSession = podStatus === "running";
  const canReadSession =
    liveSession || podStatus === "completed" || podStatus === "orphaned";
  const workspaceArtifacts = usePodWorkspaceArtifacts(podKey, canReadSession);

  // Without a relay subscription the control lease never leaves "observer", so
  // the composer would stay read-only with "take control" permanently disabled.
  // useId keeps split panes on the same pod from sharing a subscription id.
  usePodRelaySubscription(podKey, `workbench-${useId()}`, liveSession);

  const latchRef = useRef({
    controlGranted: false,
    workspaceArtifactError: null as string | null,
    decorateRuntime: decorateRuntime as PodRuntimeDecorator | undefined,
  });

  const workerRef = useMemo(
    () => ({ transport: "pod" as const, podKey }),
    [podKey],
  );

  const terminalRuntime = useMemo(
    () => new PodTerminalRuntime(podKey, `workbench-${controlClientLabel}`),
    [podKey, controlClientLabel],
  );

  useEffect(() => () => terminalRuntime.close(), [terminalRuntime]);

  useEffect(() => {
    if (!liveSession) return;
    return subscribePodWorkbenchControlRelay(
      podKey,
      `workbench-control-${controlClientLabel}`,
    );
  }, [liveSession, podKey, controlClientLabel]);

  /* Transport getters close over a stable latch updated in the effect below. */
  /* eslint-disable react-hooks/refs */
  const workerClient = useMemo(() => {
    const client = new WorkerClient();
    client.register(
      createPodWorkerTransport({
        decorateRuntime: (runtime, key) =>
          latchRef.current.decorateRuntime?.(runtime, key) ?? runtime,
        isControlGranted: () => latchRef.current.controlGranted,
        getInitProgressMessage: (key) => {
          const progress = usePodStore.getState().initProgress[key];
          if (!progress) return null;
          return progress.message || `${progress.phase} - ${progress.progress}%`;
        },
        getWorkspaceArtifactError: () => latchRef.current.workspaceArtifactError,
      }),
    );
    return client;
  }, [podKey]);
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    latchRef.current = {
      controlGranted: controlLease.status === "granted",
      workspaceArtifactError: workspaceArtifacts.error,
      decorateRuntime,
    };
    usePodStore.setState((state) => ({ _tick: state._tick + 1 }));
  }, [controlLease.status, workspaceArtifacts.error, decorateRuntime]);

  return {
    controlLease,
    liveSession,
    terminalRuntime,
    workerClient,
    workerRef,
    workspaceArtifacts: workspaceArtifacts.artifacts,
  };
}
