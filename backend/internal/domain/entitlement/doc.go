// Package entitlement is Layer 1 of the two-layer authorization model.
//
// Layer 1 — catalog admission (platform → organization):
// resources that belong to the platform (worker types, platform-level skills)
// are gated by resource_entitlements. An organization may use a platform
// resource only when this table (plus the resource's default policy) says so.
//
// Layer 2 — instance grants (organization → member):
// resources that belong to an organization (model connections, org skills,
// experts) reuse the existing resource_grants table and backend/pkg/policy.
// This package does not own Layer 2 and must not grow a second grants table.
//
// Presence-is-allow-list: a (kind, key) with no subject_kind=user allow rows
// is open to every member. The first user allow row switches that resource
// into an allow-list, where only listed users plus org owner/admin pass.
// A user deny row blocks just its target — it never arms the allow-list, so
// blocking one member cannot cut off the rest of the organization, and it
// outranks the owner/admin bypass. Expired rows are treated as absent.
package entitlement
