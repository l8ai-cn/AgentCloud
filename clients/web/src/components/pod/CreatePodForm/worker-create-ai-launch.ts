import type { EnvBundleSummary, PodData } from "@/lib/api";
import { podApi } from "@/lib/api";
import type { EffectiveResource } from "@/lib/api/facade/aiResource";
import type {
  WorkerCreateOptions,
  WorkerPreflightResult,
  WorkerSpecDraft,
} from "@/lib/api/facade/podConnect";
import { estimateWorkspaceTerminalSize } from "@/lib/terminal-size";
import { enrichDraftWithAIFill } from "./worker-create-ai-fill";
import {
  draftFromNlIntent,
  resolveWorkerCreateNlIntent,
} from "./worker-create-nl-intent";
import { workerPreflightHasBlockingIssues } from "../hooks/workerCreateController";

export interface AiLaunchInput {
  prompt: string;
  draft: WorkerSpecDraft;
  options: WorkerCreateOptions;
  models: EffectiveResource[];
  configBundles: EnvBundleSummary[];
  ticketSlug?: string;
}

export interface AiLaunchResult {
  draft: WorkerSpecDraft;
  preflight: WorkerPreflightResult;
  pod: PodData;
}

export async function launchWorkerFromNaturalLanguage(
  input: AiLaunchInput,
): Promise<AiLaunchResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("empty_prompt");
  }
  const intent = resolveWorkerCreateNlIntent(
    prompt,
    input.options,
    input.models,
  );
  if (intent.blockingReason) {
    throw new Error(intent.blockingReason);
  }

  let draft = draftFromNlIntent(
    input.draft,
    intent,
    input.options,
    input.models,
    input.configBundles,
  );
  if (!draft.worker_type_slug) {
    throw new Error("worker_type_required");
  }
  if (!draft.model_resource_id) {
    throw new Error("model_required");
  }

  draft = await enrichDraftWithAIFill(prompt, draft);

  const preflight = await podApi.preflightWorker(draft);
  if (
    workerPreflightHasBlockingIssues(preflight) ||
    !preflight.resolved_spec_json?.trim()
  ) {
    const first = preflight.issues.find(
      (issue) => issue.severity === "error" || issue.severity === "blocking",
    );
    throw new Error(first?.message || "preflight_failed");
  }

  const { cols, rows } = estimateWorkspaceTerminalSize();
  const created = await podApi.create({
    ticket_slug: input.ticketSlug,
    cols,
    rows,
    worker_spec: draft,
  });
  return { draft, preflight, pod: created.pod };
}
