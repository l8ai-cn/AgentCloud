import { describe, expect, it } from "vitest";

import { summaryRows } from "../entitlementSummaryRows";
import type {
  EntitlementRecord,
  ResourceAccessSummary,
} from "@/lib/api/entitlement/entitlementTypes";

function record(id: number, over: Partial<EntitlementRecord> = {}): EntitlementRecord {
  return {
    id,
    resource_kind: "worker_type",
    resource_key: "claude-code",
    organization_id: 7,
    subject_kind: "user",
    subject_user_id: id,
    effect: "allow",
    reason: "",
    expires_at: null,
    granted_by: 1,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

const summary: ResourceAccessSummary = {
  organization_id: 7,
  resource_kind: "worker_type",
  resource_key: "claude-code",
  org_admission: "admitted",
  member_access: "allow-list",
  allowed: [record(3)],
  denied: [record(1, { effect: "deny" })],
  org_rows: [record(2, { subject_kind: "org", subject_user_id: null })],
  expired: [record(4, { expires_at: "2026-01-01T00:00:00Z" })],
};

describe("summaryRows", () => {
  it("lists deny rows first because deny outranks every allow", () => {
    expect(summaryRows(summary).map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it("leaves expired rows out of the live list", () => {
    expect(summaryRows(summary).some((row) => row.id === 4)).toBe(false);
  });
});
