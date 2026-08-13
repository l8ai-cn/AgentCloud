import {
  blockingReasonKind,
  type BlockingReasonKind,
} from "./workerBlockingReasonLabels";

// Codes come from backend `airesource.BlockingReason`.
const reasonKeys: Record<string, string> = {
  "connection-disabled": "modelConnectionDisabled",
  "connection-unchecked": "modelConnectionUnchecked",
  "connection-invalid": "modelConnectionInvalid",
  "resource-disabled": "modelResourceDisabled",
  "resource-unchecked": "modelResourceUnchecked",
  "resource-invalid": "modelResourceInvalid",
  "not-granted": "modelNotGranted",
};

export function localizeModelBlockingReason(
  reason: string,
  t: (key: string) => string,
): { blockingReason: string; blockingKind: BlockingReasonKind } {
  const key = reasonKeys[reason];
  return {
    blockingReason: key ? t(`workerCreate.runtime.options.${key}`) : reason,
    blockingKind: blockingReasonKind(reason),
  };
}
