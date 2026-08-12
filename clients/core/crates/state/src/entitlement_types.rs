use serde::{Deserialize, Serialize};

pub const EFFECT_ALLOW: &str = "allow";
pub const EFFECT_DENY: &str = "deny";
pub const SUBJECT_ORG: &str = "org";
pub const SUBJECT_USER: &str = "user";

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct EntitlementRecord {
    pub id: i64,
    pub resource_kind: String,
    pub resource_key: String,
    pub organization_id: i64,
    pub subject_kind: String,
    pub subject_user_id: Option<i64>,
    pub effect: String,
    pub reason: String,
    pub expires_at: Option<String>,
    pub granted_by: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl EntitlementRecord {
    /// Mirrors backend `entitlement.Entitlement.LiveAt` — an expired row still
    /// exists (and is still listed, so an admin can see and clean it up) but
    /// takes no part in the decision.
    pub fn live_at(&self, now_rfc3339: &str) -> bool {
        match self.expires_at.as_deref() {
            None => true,
            Some(expiry) => truncate_subsecond(expiry) > truncate_subsecond(now_rfc3339),
        }
    }

    pub fn targets(&self, user_id: i64) -> bool {
        self.subject_user_id == Some(user_id)
    }
}

/// Wire contract: the backend emits UTC RFC3339 at second precision while
/// `Date.toISOString()` carries milliseconds, so the two are only
/// lexicographically comparable once the fractional part is dropped.
fn truncate_subsecond(value: &str) -> &str {
    match value.find('.') {
        Some(dot) => &value[..dot],
        None => value.strip_suffix('Z').unwrap_or(value),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OrgAdmission {
    /// Platform revoked the resource for this organization; outranks everything.
    Revoked,
    /// Platform wrote an explicit org-level allow row.
    Admitted,
    /// No org-level row — access falls back to the resource's platform default,
    /// which is not exposed to clients.
    Unset,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MemberAccess {
    /// No user-level allow row exists, so every member of the organization may
    /// use the resource — "presence-is-allow-list" in its unarmed state.
    Everyone,
    /// At least one user-level allow row armed the allow-list; only listed
    /// members (plus org owners/admins) keep access.
    AllowList,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ResourceAccessSummary {
    pub organization_id: i64,
    pub resource_kind: String,
    pub resource_key: String,
    pub org_admission: OrgAdmission,
    pub member_access: MemberAccess,
    pub allowed: Vec<EntitlementRecord>,
    pub denied: Vec<EntitlementRecord>,
    pub org_rows: Vec<EntitlementRecord>,
    pub expired: Vec<EntitlementRecord>,
}
