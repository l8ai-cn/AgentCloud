import type { EffectiveResource } from "@/lib/api/facade/aiResource";
import type {
  WorkerCreateOptions,
  WorkerSpecDraft,
} from "@/lib/api/facade/podConnect";
import {
  defaultConfigDocumentPatch,
  defaultModelPatch,
  defaultWorkerDraftPatch,
} from "../hooks/workerCreateDefaults";
import type { EnvBundleSummary } from "@/lib/api";

export interface WorkerCreateNlIntent {
  workerTypeSlug?: string;
  modelResourceId?: number;
  initialTask: string;
  alias?: string;
  blockingReason?: string;
}

const TYPE_ALIASES: Array<{ re: RegExp; slug: string }> = [
  { re: /\b(codex|openai\s*codex)\b/i, slug: "codex-cli" },
  { re: /\b(claude(\s*code)?)\b/i, slug: "claude-code" },
  { re: /\b(gemini(\s*cli)?)\b/i, slug: "gemini-cli" },
  { re: /\b(do[\s-]?agent)\b/i, slug: "do-agent" },
  { re: /\b(kimi\s*code)\b/i, slug: "kimi-code" },
  { re: /\b(minimax(\s*cli)?)\b/i, slug: "minimax-cli" },
];

const MODEL_ALIASES: Array<{ re: RegExp; needle: RegExp }> = [
  { re: /\bkimi\b/i, needle: /kimi/i },
  { re: /\bgpt[-\s]?5\.6\b/i, needle: /gpt-5\.6(?!-)/i },
  { re: /\bgpt[-\s]?5\.5\b/i, needle: /gpt-5\.5/i },
  { re: /\bgpt[-\s]?5\.4\b/i, needle: /gpt-5\.4/i },
  { re: /\bdeepseek\b/i, needle: /deepseek/i },
  { re: /\bminimax\b/i, needle: /minimax/i },
];

export function resolveWorkerCreateNlIntent(
  prompt: string,
  options: WorkerCreateOptions,
  models: EffectiveResource[],
): WorkerCreateNlIntent {
  const text = prompt.trim();
  if (!text) {
    return { initialTask: "", blockingReason: "empty" };
  }

  let workerTypeSlug: string | undefined;
  for (const alias of TYPE_ALIASES) {
    if (alias.re.test(text)) {
      workerTypeSlug = alias.slug;
      break;
    }
  }

  if (workerTypeSlug) {
    const type = options.worker_types.find((item) => item.slug === workerTypeSlug);
    if (!type) {
      return {
        initialTask: text,
        blockingReason: `worker_type_unknown:${workerTypeSlug}`,
      };
    }
    if (!type.selectable) {
      return {
        initialTask: text,
        workerTypeSlug,
        blockingReason: type.blocking_reason || `worker_type_unavailable:${workerTypeSlug}`,
      };
    }
  }

  let modelResourceId: number | undefined;
  for (const alias of MODEL_ALIASES) {
    if (!alias.re.test(text)) continue;
    const matches = models.filter((item) => {
      const model = item.resource;
      if (!item.selectable || !model?.isEnabled || !model.id) return false;
      const hay = `${model.modelId} ${model.displayName} ${model.identifier}`;
      return alias.needle.test(hay);
    });
    const preferred =
      matches.find((item) => {
        const hay = `${item.resource?.modelId} ${item.resource?.displayName}`;
        return /code/i.test(hay);
      }) ?? matches[0];
    if (preferred?.resource?.id) {
      modelResourceId = preferred.resource.id;
      break;
    }
    return {
      initialTask: text,
      workerTypeSlug,
      blockingReason: "model_not_found",
    };
  }

  return {
    workerTypeSlug,
    modelResourceId,
    initialTask: text,
    alias: suggestAlias(text, workerTypeSlug),
  };
}

export function draftFromNlIntent(
  current: WorkerSpecDraft,
  intent: WorkerCreateNlIntent,
  options: WorkerCreateOptions,
  models: EffectiveResource[],
  configBundles: EnvBundleSummary[],
): WorkerSpecDraft {
  let draft: WorkerSpecDraft = {
    ...current,
    initial_task: intent.initialTask || current.initial_task,
    alias: intent.alias || current.alias,
  };
  if (intent.workerTypeSlug) {
    const type = options.worker_types.find((item) => item.slug === intent.workerTypeSlug);
    draft = {
      ...draft,
      worker_type_slug: intent.workerTypeSlug,
      type_schema_version: type?.schema_version || draft.type_schema_version,
      runtime_image_id: 0,
      config_document_bindings: [],
      tool_model_resource_ids: {},
    };
  }
  draft = {
    ...draft,
    ...defaultWorkerDraftPatch(draft, options, intent.workerTypeSlug),
  };
  if (intent.modelResourceId) {
    draft = { ...draft, model_resource_id: intent.modelResourceId };
  } else {
    draft = { ...draft, ...defaultModelPatch(draft, models) };
  }
  const workerType = options.worker_types.find(
    (item) => item.slug === draft.worker_type_slug,
  );
  draft = {
    ...draft,
    ...defaultConfigDocumentPatch(draft, workerType, configBundles),
  };
  return draft;
}

function suggestAlias(prompt: string, workerTypeSlug?: string): string {
  if (workerTypeSlug === "codex-cli" && /\bkimi\b/i.test(prompt)) {
    return "codex-kimi";
  }
  if (workerTypeSlug) return workerTypeSlug;
  return "";
}
