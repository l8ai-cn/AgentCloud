// Codes come from backend `workercreation.BlockingReason`; keys are relative to
// the `workerCreate` message namespace. Draft-validation text carries no code
// and falls through untranslated.
const reasonKeys: Record<string, string> = {
  "runtime-image-missing": "runtime.options.noRuntimeImage",
  "runtime-image-disabled": "runtime.options.runtimeImageDisabled",
  "no-online-runner": "runtime.options.noOnlineRunner",
  "compute-target-disabled": "runtime.options.computeTargetDisabled",
  "no-target-for-deployment-mode": "runtime.options.noTargetForMode",
  "selected-target-unavailable": "runtime.options.selectedTargetUnavailable",
  "selected-target-mode-unsupported": "runtime.options.targetDoesNotSupportMode",
  "resource-profile-disabled": "runtime.options.resourceDisabled",
  "dedicated-provisioning-not-configured": "runtime.options.dedicatedUnavailable",
  "not-entitled": "runtime.options.notEntitled",
};

/** Authorization blocks are actionable by a human ("ask an admin"); capacity
 *  and configuration blocks are not. Callers style them differently so a
 *  greyed-out option never leaves the user guessing which kind it is. */
const authorizationReasons = new Set(["not-entitled", "not-granted"]);

export type BlockingReasonKind = "authorization" | "other";

export function blockingReasonKind(reason: string): BlockingReasonKind {
  return authorizationReasons.has(reason) ? "authorization" : "other";
}

export function localizeWorkerBlockingReason(
  reason: string,
  translate: (key: string) => string,
): string {
  const key = reasonKeys[reason];
  return key ? translate(key) : reason;
}

export function localizeWorkerBlockingReasons<T extends { blockingReason: string }>(
  options: T[],
  translate: (key: string) => string,
): (T & { blockingKind: BlockingReasonKind })[] {
  return options.map((option) => ({
    ...option,
    blockingKind: blockingReasonKind(option.blockingReason),
    blockingReason: localizeWorkerBlockingReason(option.blockingReason, translate),
  }));
}
