"use client";

import {
  WorkerConversation,
  WorkerProvider,
  createBuiltinContentRenderers,
  createBuiltinToolRenderers,
} from "@agent-cloud/agent-ui";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";

import { usePodWorkerSession } from "@/components/workspace/agent-ui/usePodWorkerSession";
import { DoAgentGoalBar, useDoAgentGoalSync } from "@/components/doagent/DoAgentGoalBar";
import { DoAgentWorkspaceLink } from "@/components/doagent/DoAgentWorkspaceLink";
import { useDomainControlRelay } from "@/hooks/useDomainControlRelay";

const CONTENT_RENDERERS = createBuiltinContentRenderers();
const TOOL_RENDERERS = createBuiltinToolRenderers();

export default function DoAgentConsolePage() {
  const params = useParams();
  const locale = useLocale();
  const podKey = typeof params.podKey === "string" ? params.podKey : "";
  const session = usePodWorkerSession(podKey, `doagent-${podKey}`);

  // Goal control stays on the relay control channel; the conversation itself is
  // projected from the workbench session, so both must be subscribed.
  useDomainControlRelay(podKey, `doagent-${podKey}`, !!podKey);
  useDoAgentGoalSync(podKey, !!podKey);

  if (!podKey) return null;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <WorkerProvider client={session.workerClient}>
        <WorkerConversation
          className="flex-1"
          clientLabel={`doagent-${podKey}`}
          contentRenderers={CONTENT_RENDERERS}
          domainPanel={<DoAgentGoalBar podKey={podKey} />}
          headerActions={<DoAgentWorkspaceLink podKey={podKey} />}
          locale={locale === "zh" ? "zh-CN" : "en-US"}
          presentation="user"
          toolRenderers={TOOL_RENDERERS}
          workerRef={session.workerRef}
          workspaceArtifacts={session.workspaceArtifacts}
        />
      </WorkerProvider>
    </div>
  );
}
