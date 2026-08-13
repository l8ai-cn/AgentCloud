// Facade re-export of the Layer 1 org-side Connect-RPC adapter. Business code
// imports from here so the wire-shape layer stays internal to the facade
// boundary. Tests mock this path.

export {
  fromProtoEntitlement,
  listEntitlements,
  readSummaries,
  readSummary,
  grantMemberEntitlement,
  denyMemberEntitlement,
  deleteMemberEntitlement,
} from "../connect/entitlementConnect";
