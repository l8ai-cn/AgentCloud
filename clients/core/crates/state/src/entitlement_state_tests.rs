use crate::entitlement_state::{summarize_records, EntitlementState};
use crate::entitlement_types::{
    EntitlementRecord, MemberAccess, OrgAdmission, EFFECT_ALLOW, EFFECT_DENY, SUBJECT_ORG,
    SUBJECT_USER,
};

const NOW: &str = "2026-08-13T00:00:00.000Z";

fn org_row(id: i64, effect: &str) -> EntitlementRecord {
    EntitlementRecord {
        id,
        resource_kind: "worker_type".into(),
        resource_key: "claude-code".into(),
        organization_id: 7,
        subject_kind: SUBJECT_ORG.into(),
        effect: effect.into(),
        ..Default::default()
    }
}

fn user_row(id: i64, user_id: i64, effect: &str) -> EntitlementRecord {
    EntitlementRecord {
        id,
        resource_kind: "worker_type".into(),
        resource_key: "claude-code".into(),
        organization_id: 7,
        subject_kind: SUBJECT_USER.into(),
        subject_user_id: Some(user_id),
        effect: effect.into(),
        ..Default::default()
    }
}

fn state(records: Vec<EntitlementRecord>) -> EntitlementState {
    let mut s = EntitlementState::new();
    s.set_records(7, records);
    s
}

#[test]
fn new_is_empty() {
    let s = EntitlementState::new();
    assert!(s.records().is_empty());
    assert!(s.summaries(NOW).is_empty());
    assert_eq!(s.organization_id(), 0);
}

#[test]
fn no_user_allow_rows_means_everyone() {
    let s = state(vec![org_row(1, EFFECT_ALLOW)]);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.member_access, MemberAccess::Everyone);
    assert_eq!(summary.org_admission, OrgAdmission::Admitted);
    assert!(summary.allowed.is_empty());
}

#[test]
fn first_user_allow_row_arms_the_allow_list() {
    let s = state(vec![org_row(1, EFFECT_ALLOW), user_row(2, 42, EFFECT_ALLOW)]);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.member_access, MemberAccess::AllowList);
    assert_eq!(summary.allowed.len(), 1);
    assert_eq!(summary.allowed[0].subject_user_id, Some(42));
}

#[test]
fn user_deny_row_alone_does_not_arm_the_allow_list() {
    let s = state(vec![org_row(1, EFFECT_ALLOW), user_row(2, 42, EFFECT_DENY)]);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.member_access, MemberAccess::Everyone);
    assert_eq!(summary.denied.len(), 1);
}

#[test]
fn org_deny_row_outranks_org_allow() {
    let s = state(vec![org_row(1, EFFECT_ALLOW), org_row(2, EFFECT_DENY)]);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.org_admission, OrgAdmission::Revoked);
    assert_eq!(summary.org_rows.len(), 2);
}

#[test]
fn missing_org_row_reports_unset_admission() {
    let s = state(vec![user_row(1, 42, EFFECT_ALLOW)]);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.org_admission, OrgAdmission::Unset);
    assert_eq!(summary.member_access, MemberAccess::AllowList);
}

#[test]
fn expired_allow_row_does_not_arm_the_allow_list() {
    let mut expired = user_row(2, 42, EFFECT_ALLOW);
    expired.expires_at = Some("2026-08-12T23:59:59Z".into());
    let s = state(vec![org_row(1, EFFECT_ALLOW), expired]);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.member_access, MemberAccess::Everyone);
    assert!(summary.allowed.is_empty());
    assert_eq!(summary.expired.len(), 1);
}

#[test]
fn future_expiry_still_counts_as_live() {
    let mut future = user_row(2, 42, EFFECT_ALLOW);
    future.expires_at = Some("2026-08-14T00:00:00Z".into());
    let s = state(vec![future]);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.member_access, MemberAccess::AllowList);
    assert!(summary.expired.is_empty());
}

#[test]
fn summaries_group_by_resource() {
    let mut skill = user_row(3, 42, EFFECT_ALLOW);
    skill.resource_kind = "skill".into();
    skill.resource_key = "merge".into();
    let s = state(vec![org_row(1, EFFECT_ALLOW), skill]);
    let summaries = s.summaries(NOW);
    assert_eq!(summaries.len(), 2);
    assert_eq!(summaries[0].resource_kind, "skill");
    assert_eq!(summaries[1].resource_kind, "worker_type");
}

#[test]
fn unknown_resource_summarizes_as_open() {
    let s = state(vec![org_row(1, EFFECT_ALLOW)]);
    let summary = s.summary_for("skill", "ghost", NOW);
    assert_eq!(summary.member_access, MemberAccess::Everyone);
    assert_eq!(summary.org_admission, OrgAdmission::Unset);
}

#[test]
fn remove_drops_the_row_and_disarms_the_allow_list() {
    let mut s = state(vec![org_row(1, EFFECT_ALLOW), user_row(2, 42, EFFECT_ALLOW)]);
    s.remove(2);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.member_access, MemberAccess::Everyone);
    assert_eq!(s.records().len(), 1);
}

#[test]
fn upsert_replaces_by_id() {
    let mut s = state(vec![user_row(2, 42, EFFECT_ALLOW)]);
    s.upsert(user_row(2, 42, EFFECT_DENY));
    assert_eq!(s.records().len(), 1);
    let summary = s.summary_for("worker_type", "claude-code", NOW);
    assert_eq!(summary.member_access, MemberAccess::Everyone);
    assert_eq!(summary.denied.len(), 1);
}

#[test]
fn upsert_appends_unknown_id() {
    let mut s = state(vec![user_row(2, 42, EFFECT_ALLOW)]);
    s.upsert(user_row(3, 43, EFFECT_ALLOW));
    assert_eq!(s.summary_for("worker_type", "claude-code", NOW).allowed.len(), 2);
}

#[test]
fn clear_resets_org_scope() {
    let mut s = state(vec![org_row(1, EFFECT_ALLOW)]);
    s.clear();
    assert_eq!(s.organization_id(), 0);
    assert!(s.records().is_empty());
}

#[test]
fn cross_org_rows_summarize_per_organization() {
    let mut other_org = user_row(9, 42, EFFECT_ALLOW);
    other_org.organization_id = 8;
    let summaries = summarize_records(&[org_row(1, EFFECT_ALLOW), other_org], NOW);
    assert_eq!(summaries.len(), 2);
    assert_eq!(summaries[0].organization_id, 7);
    assert_eq!(summaries[0].member_access, MemberAccess::Everyone);
    assert_eq!(summaries[1].organization_id, 8);
    assert_eq!(summaries[1].member_access, MemberAccess::AllowList);
}

#[test]
fn targets_matches_the_subject_user() {
    let row = user_row(2, 42, EFFECT_ALLOW);
    assert!(row.targets(42));
    assert!(!row.targets(43));
    assert!(!org_row(1, EFFECT_ALLOW).targets(42));
}
