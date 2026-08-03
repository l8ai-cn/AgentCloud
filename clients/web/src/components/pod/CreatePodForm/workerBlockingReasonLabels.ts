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
};

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
): T[] {
  return options.map((option) => ({
    ...option,
    blockingReason: localizeWorkerBlockingReason(option.blockingReason, translate),
  }));
}
