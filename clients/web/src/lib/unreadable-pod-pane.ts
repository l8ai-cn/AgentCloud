import { ApiError } from "@/lib/api/api-types";
import { isPermissionDenied, isResourceNotFound } from "@/lib/errors/serviceError";
import { useWorkspaceStore } from "@/stores/workspace";

// A pod that answers 404 or 403 will never answer differently to the same
// caller, so every retry is pure noise. Panes persist in localStorage across
// sign-ins, so after an account switch the restored panes point at another
// user's pods and each one used to retry GetPod eight times per mount.
export function isPodUnreadableForever(error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return true;
  return isResourceNotFound(error) || isPermissionDenied(error);
}

export function dropUnreadablePodPane(podKey: string): void {
  useWorkspaceStore.getState().removePaneByPodKey(podKey);
}

export function unreadablePodMessage(error: unknown): string {
  const forbidden = error instanceof ApiError
    ? error.status === 403
    : isPermissionDenied(error);
  return forbidden ? "No access to this Worker" : "Pod not found";
}
