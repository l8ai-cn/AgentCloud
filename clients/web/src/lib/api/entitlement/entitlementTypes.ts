// Mirrors agentcloud_state::entitlement_types. The Rust selector is the SSOT
// for the presence-is-allow-list verdict; these are the shapes it serialises.

export const ENTITLEMENT_KINDS = ["worker_type", "skill"] as const;
export type EntitlementKind = (typeof ENTITLEMENT_KINDS)[number];

export type EntitlementEffect = "allow" | "deny";
export type EntitlementSubjectKind = "org" | "user";

export interface EntitlementRecord {
  id: number;
  resource_kind: string;
  resource_key: string;
  organization_id: number;
  subject_kind: EntitlementSubjectKind;
  subject_user_id: number | null;
  effect: EntitlementEffect;
  reason: string;
  expires_at: string | null;
  granted_by: number;
  created_at: string;
  updated_at: string;
}

/** Platform → organization admission. `unset` means no org-level row exists and
 *  access falls back to the resource's platform default, which is server-side. */
export type OrgAdmission = "revoked" | "admitted" | "unset";

/** `everyone` = the allow-list is unarmed; `allow-list` = at least one member
 *  allow row exists, so only listed members (plus org admins) keep access. */
export type MemberAccess = "everyone" | "allow-list";

export interface ResourceAccessSummary {
  organization_id: number;
  resource_kind: string;
  resource_key: string;
  org_admission: OrgAdmission;
  member_access: MemberAccess;
  allowed: EntitlementRecord[];
  denied: EntitlementRecord[];
  org_rows: EntitlementRecord[];
  expired: EntitlementRecord[];
}

export interface MemberEntitlementInput {
  orgSlug: string;
  resourceKind: string;
  resourceKey: string;
  userId: number;
  reason: string;
  expiresAt?: string;
}
