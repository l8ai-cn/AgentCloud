use std::sync::Arc;

use agentcloud_api_client::ApiClient;
use agentcloud_types::proto_entitlement_v1 as ep;
use prost::Message;

/// Layer 1 (catalog admission) pass-through. Both proto services land here
/// because they share the wire codec; the auth surfaces stay separated by the
/// procedure paths in ApiClient, exactly as the two .proto files intend.
pub struct EntitlementService {
    client: Arc<ApiClient>,
}

impl EntitlementService {
    pub fn new(client: Arc<ApiClient>) -> Self {
        Self { client }
    }

    // TS encodes via @bufbuild/protobuf .toBinary() → wasm bridge → here →
    // ApiClient.*_connect (binary in / binary out, conventions §2.5). No
    // JSON path on the client.

    pub async fn list_entitlements_connect(&self, request_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let req = ep::ListEntitlementsRequest::decode(request_bytes)
            .map_err(|e| format!("decode list_entitlements request: {e}"))?;
        tracing::debug!(target: "entitlement", org_slug = %req.org_slug, "list entitlements");
        let resp = self
            .client
            .list_entitlements_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn grant_member_entitlement_connect(
        &self,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, String> {
        let req = ep::GrantMemberEntitlementRequest::decode(request_bytes)
            .map_err(|e| format!("decode grant_member_entitlement request: {e}"))?;
        tracing::info!(target: "entitlement", org_slug = %req.org_slug, resource_kind = %req.resource_kind, resource_key = %req.resource_key, user_id = req.user_id, "grant member entitlement");
        let resp = self
            .client
            .grant_member_entitlement_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn deny_member_entitlement_connect(
        &self,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, String> {
        let req = ep::DenyMemberEntitlementRequest::decode(request_bytes)
            .map_err(|e| format!("decode deny_member_entitlement request: {e}"))?;
        tracing::info!(target: "entitlement", org_slug = %req.org_slug, resource_kind = %req.resource_kind, resource_key = %req.resource_key, user_id = req.user_id, "deny member entitlement");
        let resp = self
            .client
            .deny_member_entitlement_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn delete_member_entitlement_connect(
        &self,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, String> {
        let req = ep::DeleteMemberEntitlementRequest::decode(request_bytes)
            .map_err(|e| format!("decode delete_member_entitlement request: {e}"))?;
        tracing::info!(target: "entitlement", org_slug = %req.org_slug, id = req.id, "delete member entitlement");
        let resp = self
            .client
            .delete_member_entitlement_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn list_organization_entitlements_connect(
        &self,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, String> {
        let req = ep::ListOrganizationEntitlementsRequest::decode(request_bytes)
            .map_err(|e| format!("decode list_organization_entitlements request: {e}"))?;
        tracing::debug!(target: "entitlement", organization_id = req.organization_id, "list organization entitlements");
        let resp = self
            .client
            .list_organization_entitlements_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn list_resource_entitlements_connect(
        &self,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, String> {
        let req = ep::ListResourceEntitlementsRequest::decode(request_bytes)
            .map_err(|e| format!("decode list_resource_entitlements request: {e}"))?;
        tracing::debug!(target: "entitlement", resource_kind = %req.resource_kind, resource_key = %req.resource_key, "list resource entitlements");
        let resp = self
            .client
            .list_resource_entitlements_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn grant_entitlement_connect(&self, request_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let req = ep::GrantEntitlementRequest::decode(request_bytes)
            .map_err(|e| format!("decode grant_entitlement request: {e}"))?;
        tracing::info!(target: "entitlement", organization_id = req.organization_id, resource_kind = %req.resource_kind, resource_key = %req.resource_key, "grant entitlement");
        let resp = self
            .client
            .grant_entitlement_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn deny_entitlement_connect(&self, request_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let req = ep::DenyEntitlementRequest::decode(request_bytes)
            .map_err(|e| format!("decode deny_entitlement request: {e}"))?;
        tracing::info!(target: "entitlement", organization_id = req.organization_id, resource_kind = %req.resource_kind, resource_key = %req.resource_key, "deny entitlement");
        let resp = self
            .client
            .deny_entitlement_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn delete_entitlement_connect(&self, request_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let req = ep::DeleteEntitlementRequest::decode(request_bytes)
            .map_err(|e| format!("decode delete_entitlement request: {e}"))?;
        tracing::info!(target: "entitlement", id = req.id, "delete entitlement");
        let resp = self
            .client
            .delete_entitlement_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }
}
