export function aiLaunchErrorMessage(
  error: unknown,
  t: (key: string) => string,
): string {
  const code = error instanceof Error ? error.message : "failed";
  if (
    code.startsWith("No online Runner") ||
    code.includes("worker_type_unavailable")
  ) {
    return t("workers.create.quick.errors.runnerUnavailable");
  }
  if (code === "model_not_found" || code === "model_required") {
    return t("workers.create.quick.errors.modelUnavailable");
  }
  if (
    code === "worker_type_required" ||
    code.startsWith("worker_type_unknown")
  ) {
    return t("workers.create.quick.errors.workerTypeRequired");
  }
  if (code === "empty_prompt") return t("workers.create.quick.taskRequired");
  if (code === "preflight_failed") {
    return t("workers.create.quick.preflightFailed");
  }
  return code || t("workers.create.quick.preflightFailed");
}
