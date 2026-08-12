import { getEntitlementState } from "@/lib/wasm-core";
import type {
  EntitlementRecord,
  ResourceAccessSummary,
} from "@/lib/api/entitlement/entitlementTypes";

/** The platform view spans organizations, so its rows must not be folded into
 *  the org-scoped Rust cache — they go through the same selector as a pure
 *  call instead, keeping one implementation of the allow-list rule. */
export function summarizeEntitlementRecords(
  records: EntitlementRecord[],
): ResourceAccessSummary[] {
  const raw = getEntitlementState().summarizeJson(
    JSON.stringify(records),
    new Date().toISOString(),
  );
  return JSON.parse(raw || "[]") as ResourceAccessSummary[];
}
