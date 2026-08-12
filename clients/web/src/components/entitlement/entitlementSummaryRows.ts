import type {
  EntitlementRecord,
  ResourceAccessSummary,
} from "@/lib/api/entitlement/entitlementTypes";

/** Deny first because it outranks every allow, including the admin exemption —
 *  reading order should match precedence order. */
export function summaryRows(summary: ResourceAccessSummary): EntitlementRecord[] {
  return [...summary.denied, ...summary.org_rows, ...summary.allowed];
}

export function expiredRows(summary: ResourceAccessSummary): EntitlementRecord[] {
  return summary.expired;
}
