use std::sync::Arc;

use agentcloud_state::app_state::AppState;
use agentcloud_state::entitlement_types::EntitlementRecord;
use agentcloud_types::proto_entitlement_v1 as ep;
use parking_lot::RwLock;
use prost::Message;
use wasm_bindgen::prelude::*;

/// Org-scoped view over the Layer 1 entitlement cache. The presence-is-allow-list
/// verdict is derived in Rust (SSOT) and handed to the UI as JSON summaries, so
/// no front-end re-implements the "first user allow row arms the allow-list"
/// rule and drifts from the backend decider.
///
/// `now_rfc3339` is passed in rather than read from a clock because the crate
/// has no date dependency and the caller already holds the browser clock.
#[wasm_bindgen]
pub struct WasmEntitlementState {
    state: Arc<RwLock<AppState>>,
}

impl WasmEntitlementState {
    pub(crate) fn from_runtime(state: Arc<RwLock<AppState>>) -> Self {
        Self { state }
    }
}

#[wasm_bindgen]
impl WasmEntitlementState {
    #[wasm_bindgen(js_name = applyEntitlements)]
    pub fn apply_entitlements(
        &self,
        organization_id: f64,
        response: &[u8],
    ) -> Result<(), JsValue> {
        let decoded = ep::ListEntitlementsResponse::decode(response)
            .map_err(|e| JsValue::from_str(&format!("decode entitlements: {e}")))?;
        let records = decoded.items.iter().map(record_from_proto).collect();
        self.state
            .write()
            .entitlements
            .set_records(organization_id as i64, records);
        Ok(())
    }

    #[wasm_bindgen(js_name = applyEntitlement)]
    pub fn apply_entitlement(&self, response: &[u8]) -> Result<(), JsValue> {
        let decoded = ep::Entitlement::decode(response)
            .map_err(|e| JsValue::from_str(&format!("decode entitlement: {e}")))?;
        self.state
            .write()
            .entitlements
            .upsert(record_from_proto(&decoded));
        Ok(())
    }

    pub fn remove(&self, id: f64) {
        self.state.write().entitlements.remove(id as i64);
    }

    pub fn clear(&self) {
        self.state.write().entitlements.clear();
    }

    #[wasm_bindgen(js_name = recordsJson)]
    pub fn records_json(&self) -> String {
        serde_json::to_string(self.state.read().entitlements.records())
            .unwrap_or_else(|_| "[]".into())
    }

    #[wasm_bindgen(js_name = summariesJson)]
    pub fn summaries_json(&self, now_rfc3339: &str) -> String {
        serde_json::to_string(&self.state.read().entitlements.summaries(now_rfc3339))
            .unwrap_or_else(|_| "[]".into())
    }

    /// Platform-admin surface: those rows span organizations, so folding them
    /// into this org-scoped cache would corrupt it. They are summarised through
    /// the same selector instead, keeping one implementation of the rule.
    #[wasm_bindgen(js_name = summarizeJson)]
    pub fn summarize_json(&self, records_json: &str, now_rfc3339: &str) -> Result<String, JsValue> {
        let records: Vec<EntitlementRecord> = serde_json::from_str(records_json)
            .map_err(|e| JsValue::from_str(&format!("decode entitlement records: {e}")))?;
        let summaries =
            agentcloud_state::entitlement_state::summarize_records(&records, now_rfc3339);
        serde_json::to_string(&summaries)
            .map_err(|e| JsValue::from_str(&format!("encode entitlement summaries: {e}")))
    }

    #[wasm_bindgen(js_name = summaryJson)]
    pub fn summary_json(&self, kind: &str, key: &str, now_rfc3339: &str) -> String {
        let summary = self
            .state
            .read()
            .entitlements
            .summary_for(kind, key, now_rfc3339);
        serde_json::to_string(&summary).unwrap_or_else(|_| "null".into())
    }
}

fn record_from_proto(row: &ep::Entitlement) -> EntitlementRecord {
    EntitlementRecord {
        id: row.id,
        resource_kind: row.resource_kind.clone(),
        resource_key: row.resource_key.clone(),
        organization_id: row.organization_id,
        subject_kind: row.subject_kind.clone(),
        subject_user_id: row.subject_user_id,
        effect: row.effect.clone(),
        reason: row.reason.clone(),
        expires_at: row.expires_at.clone(),
        granted_by: row.granted_by,
        created_at: row.created_at.clone(),
        updated_at: row.updated_at.clone(),
    }
}
