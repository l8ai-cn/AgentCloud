import type { WorkerRuntimeSelectOption } from "./WorkerRuntimeSelectField";
import { localizeWorkerBlockingReason } from "./workerBlockingReasonLabels";

type RuntimeOptionKind =
  | "workerType"
  | "runtimeImage"
  | "computeTarget"
  | "deploymentMode"
  | "resourceProfile";

type Translate = (key: string) => string;

const workerTypeLabels: Record<string, string> = {
  "codex-cli": "workerCreate.runtime.options.codex",
  "claude-code": "workerCreate.runtime.options.claude",
  "gemini-cli": "workerCreate.runtime.options.gemini",
  "minimax-cli": "workerCreate.runtime.options.minimax",
  openclaw: "workerCreate.runtime.options.openclaw",
  "do-agent": "workerCreate.runtime.options.doAgent",
  "seedance-expert": "workerCreate.runtime.options.seedance",
  "pattern-designer": "workerCreate.runtime.options.patternDesigner",
  aider: "workerCreate.runtime.options.aider",
  opencode: "workerCreate.runtime.options.openCode",
  cursor: "workerCreate.runtime.options.cursor",
};


export function localizeWorkerRuntimeOption(
  kind: RuntimeOptionKind,
  value: string,
  name: string,
  selectable: boolean,
  blockingReason: string,
  t: Translate,
  lookupValue = value,
): WorkerRuntimeSelectOption {
  return {
    value,
    label: localizeLabel(kind, lookupValue, name, t),
    selectable,
    blockingReason: localizeReason(blockingReason, t),
  };
}

function localizeLabel(
  kind: RuntimeOptionKind,
  value: string,
  name: string,
  t: Translate,
): string {
  const key = labelKey(kind, value);
  if (key) return t(key);
  return name.replace(/\s+\(local development\)$/i, "");
}

function labelKey(kind: RuntimeOptionKind, value: string): string | undefined {
  if (kind === "workerType") return workerTypeLabels[value];
  if (kind === "computeTarget") {
    if (value === "organization-runner-pool") {
      return "workerCreate.runtime.options.organizationRunnerPool";
    }
    if (value === "managed-kubernetes") {
      return "workerCreate.runtime.options.managedKubernetes";
    }
  }
  if (kind === "deploymentMode") {
    if (value === "pooled") return "workerCreate.runtime.options.pooled";
    if (value === "dedicated") return "workerCreate.runtime.options.dedicated";
  }
  if (kind === "resourceProfile") {
    if (value === "standard" || value === "1") {
      return "workerCreate.runtime.options.standard";
    }
    if (value === "large" || value === "2") {
      return "workerCreate.runtime.options.large";
    }
  }
  return undefined;
}

function localizeReason(reason: string, t: Translate): string {
  return localizeWorkerBlockingReason(reason, (key) => t(`workerCreate.${key}`));
}
