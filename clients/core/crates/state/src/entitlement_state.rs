use std::collections::BTreeMap;

use crate::entitlement_types::{
    EntitlementRecord, MemberAccess, OrgAdmission, ResourceAccessSummary, EFFECT_ALLOW,
    EFFECT_DENY, SUBJECT_ORG,
};

/// Client-side cache for Layer 1 entitlement rows of a single organization.
/// Holds the rows verbatim; every verdict is derived on read so the same
/// records can answer both the platform-admin and the org-admin view.
#[derive(Default)]
pub struct EntitlementState {
    organization_id: i64,
    records: Vec<EntitlementRecord>,
}

impl EntitlementState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn organization_id(&self) -> i64 {
        self.organization_id
    }

    pub fn records(&self) -> &[EntitlementRecord] {
        &self.records
    }

    pub fn set_records(&mut self, organization_id: i64, records: Vec<EntitlementRecord>) {
        tracing::debug!(target: "entitlement", organization_id, count = records.len(), "set entitlements (baseline)");
        self.organization_id = organization_id;
        self.records = records;
    }

    pub fn upsert(&mut self, record: EntitlementRecord) {
        match self.records.iter_mut().find(|row| row.id == record.id) {
            Some(existing) => *existing = record,
            None => self.records.push(record),
        }
    }

    pub fn remove(&mut self, id: i64) {
        self.records.retain(|row| row.id != id);
    }

    pub fn clear(&mut self) {
        self.organization_id = 0;
        self.records.clear();
    }

    pub fn summaries(&self, now_rfc3339: &str) -> Vec<ResourceAccessSummary> {
        summarize_records(&self.records, now_rfc3339)
    }

    pub fn summary_for(&self, kind: &str, key: &str, now_rfc3339: &str) -> ResourceAccessSummary {
        let rows: Vec<&EntitlementRecord> = self
            .records
            .iter()
            .filter(|row| row.resource_kind == kind && row.resource_key == key)
            .collect();
        summarize(self.organization_id, kind, key, rows, now_rfc3339)
    }
}

/// Free-standing so the platform-admin view — whose rows span organizations
/// and must never land in the org-scoped cache — reads the same verdict.
pub fn summarize_records(
    records: &[EntitlementRecord],
    now_rfc3339: &str,
) -> Vec<ResourceAccessSummary> {
    let mut grouped: BTreeMap<(i64, &str, &str), Vec<&EntitlementRecord>> = BTreeMap::new();
    for row in records {
        grouped
            .entry((
                row.organization_id,
                row.resource_kind.as_str(),
                row.resource_key.as_str(),
            ))
            .or_default()
            .push(row);
    }
    grouped
        .into_iter()
        .map(|((org, kind, key), rows)| summarize(org, kind, key, rows, now_rfc3339))
        .collect()
}

fn summarize(
    organization_id: i64,
    kind: &str,
    key: &str,
    rows: Vec<&EntitlementRecord>,
    now_rfc3339: &str,
) -> ResourceAccessSummary {
    let mut summary = ResourceAccessSummary {
        organization_id,
        resource_kind: kind.to_string(),
        resource_key: key.to_string(),
        org_admission: OrgAdmission::Unset,
        member_access: MemberAccess::Everyone,
        allowed: Vec::new(),
        denied: Vec::new(),
        org_rows: Vec::new(),
        expired: Vec::new(),
    };
    for row in rows {
        if !row.live_at(now_rfc3339) {
            summary.expired.push(row.clone());
            continue;
        }
        if row.subject_kind == SUBJECT_ORG {
            if row.effect == EFFECT_DENY {
                summary.org_admission = OrgAdmission::Revoked;
            } else if summary.org_admission == OrgAdmission::Unset {
                summary.org_admission = OrgAdmission::Admitted;
            }
            summary.org_rows.push(row.clone());
            continue;
        }
        match row.effect.as_str() {
            EFFECT_DENY => summary.denied.push(row.clone()),
            EFFECT_ALLOW => {
                // Only allow rows arm the allow-list; if deny rows armed it too,
                // blocking one member would silently cut off the whole org.
                summary.member_access = MemberAccess::AllowList;
                summary.allowed.push(row.clone());
            }
            _ => {}
        }
    }
    summary
}
