import workerRuntimeCatalog from "@/generated/worker-runtime-catalog.json";
import type { EntitlementKind } from "@/lib/api/entitlement/entitlementTypes";

export interface EntitlementResourceOption {
  value: string;
  label: string;
}

export function workerTypeOptions(): EntitlementResourceOption[] {
  return workerRuntimeCatalog.workers
    .map((worker) => ({ value: worker.slug, label: `${worker.name} (${worker.slug})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Platform skills have no client-side catalog — the slug list lives entirely
 *  in the database, so the skill picker falls back to free text. */
export function resourceOptionsFor(kind: EntitlementKind): EntitlementResourceOption[] {
  return kind === "worker_type" ? workerTypeOptions() : [];
}
