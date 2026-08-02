"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WorkerConversation,
  WorkerProvider,
  createBuiltinContentRenderers,
  createBuiltinToolRenderers,
  type AgentSessionRuntime,
} from "@agent-cloud/agent-ui";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";

import { usePodWorkerSession } from "@/components/workspace/agent-ui/usePodWorkerSession";
import { LoopalBottomDock } from "@/components/loopal/dock/LoopalBottomDock";
import { LoopalStatusActions } from "@/components/loopal/status/LoopalStatusActions";
import { LoopalTopologySheet } from "@/components/loopal/topology/LoopalTopologySheet";
import { createLoopalSlashRuntime } from "@/components/loopal/loopalSlashRuntime";
import {
  buildLoopalCommandSpecs,
  resolveLoopalCommand,
  toAgentCommands,
} from "@/components/loopal/loopalCommandSpecs";
import { loopalControl } from "@/components/loopal/loopalControl";
import { useDomainControlRelay } from "@/hooks/useDomainControlRelay";
import { useLoopalSession } from "@/stores/loopalConsole";

const CONTENT_RENDERERS = createBuiltinContentRenderers();
const TOOL_RENDERERS = createBuiltinToolRenderers();

export default function LoopalConsolePage() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations("loopal");
  const podKey = typeof params.podKey === "string" ? params.podKey : "";
  const [topoOpen, setTopoOpen] = useState(false);

  // Loopal's control verbs have no session-API equivalent, so the relay control
  // channel stays subscribed alongside the workbench session.
  useDomainControlRelay(podKey, `loopal-${podKey}`, !!podKey);
  const { thread_goal } = useLoopalSession(podKey);

  const specs = useMemo(
    () => buildLoopalCommandSpecs({ hasGoal: !!thread_goal, t }),
    [thread_goal, t],
  );
  const commands = useMemo(() => toAgentCommands(specs), [specs]);

  // The runtime decorator is cached per session by the transport, so it must be
  // referentially stable and read the live command list through a ref.
  const liveRef = useRef({ specs, commands });
  useEffect(() => {
    liveRef.current = { specs, commands };
  }, [specs, commands]);

  const decorateRuntime = useCallback(
    (runtime: AgentSessionRuntime, key: string) =>
      createLoopalSlashRuntime(runtime, {
        getCommands: () => liveRef.current.commands,
        dispatch: (name, argument) => {
          const call = resolveLoopalCommand(liveRef.current.specs, name, argument);
          if (call) loopalControl(key, call.subtype, call.payload);
        },
      }),
    [],
  );

  const session = usePodWorkerSession(podKey, `loopal-${podKey}`, decorateRuntime);

  if (!podKey) return null;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <WorkerProvider client={session.workerClient}>
        <WorkerConversation
          className="flex-1"
          clientLabel={`loopal-${podKey}`}
          contentRenderers={CONTENT_RENDERERS}
          domainPanel={
            <LoopalBottomDock
              onExpandTopology={() => setTopoOpen(true)}
              podKey={podKey}
            />
          }
          headerActions={
            <LoopalStatusActions
              onOpenTopology={() => setTopoOpen(true)}
              podKey={podKey}
            />
          }
          locale={locale === "zh" ? "zh-CN" : "en-US"}
          presentation="developer"
          toolRenderers={TOOL_RENDERERS}
          workerRef={session.workerRef}
          workspaceArtifacts={session.workspaceArtifacts}
        />
      </WorkerProvider>
      <LoopalTopologySheet
        onOpenChange={setTopoOpen}
        open={topoOpen}
        podKey={podKey}
      />
    </div>
  );
}
