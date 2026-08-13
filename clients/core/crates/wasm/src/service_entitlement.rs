use std::sync::Arc;

use agentcloud_api_client::ApiClient;
use agentcloud_services::EntitlementService;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmEntitlementService(pub(crate) EntitlementService);

#[wasm_bindgen]
impl WasmEntitlementService {
    pub(crate) fn new(client: Arc<ApiClient>) -> Self {
        Self(EntitlementService::new(client))
    }

    // -------- Connect-RPC (binary wire) --------
    //
    // TS encodes the request via @bufbuild/protobuf .toBinary(), passes the
    // Uint8Array in, receives a Uint8Array back, decodes via .fromBinary().
    // No JSON intermediate; conventions §2.5 forbids it on the client.

    #[wasm_bindgen(js_name = listEntitlementsConnect)]
    pub async fn list_entitlements_connect(&self, request: &[u8]) -> Result<Vec<u8>, String> {
        self.0.list_entitlements_connect(request).await
    }

    #[wasm_bindgen(js_name = grantMemberEntitlementConnect)]
    pub async fn grant_member_entitlement_connect(
        &self,
        request: &[u8],
    ) -> Result<Vec<u8>, String> {
        self.0.grant_member_entitlement_connect(request).await
    }

    #[wasm_bindgen(js_name = denyMemberEntitlementConnect)]
    pub async fn deny_member_entitlement_connect(&self, request: &[u8]) -> Result<Vec<u8>, String> {
        self.0.deny_member_entitlement_connect(request).await
    }

    #[wasm_bindgen(js_name = deleteMemberEntitlementConnect)]
    pub async fn delete_member_entitlement_connect(
        &self,
        request: &[u8],
    ) -> Result<Vec<u8>, String> {
        self.0.delete_member_entitlement_connect(request).await
    }

    #[wasm_bindgen(js_name = listOrganizationEntitlementsConnect)]
    pub async fn list_organization_entitlements_connect(
        &self,
        request: &[u8],
    ) -> Result<Vec<u8>, String> {
        self.0.list_organization_entitlements_connect(request).await
    }

    #[wasm_bindgen(js_name = listResourceEntitlementsConnect)]
    pub async fn list_resource_entitlements_connect(
        &self,
        request: &[u8],
    ) -> Result<Vec<u8>, String> {
        self.0.list_resource_entitlements_connect(request).await
    }

    #[wasm_bindgen(js_name = grantEntitlementConnect)]
    pub async fn grant_entitlement_connect(&self, request: &[u8]) -> Result<Vec<u8>, String> {
        self.0.grant_entitlement_connect(request).await
    }

    #[wasm_bindgen(js_name = denyEntitlementConnect)]
    pub async fn deny_entitlement_connect(&self, request: &[u8]) -> Result<Vec<u8>, String> {
        self.0.deny_entitlement_connect(request).await
    }

    #[wasm_bindgen(js_name = deleteEntitlementConnect)]
    pub async fn delete_entitlement_connect(&self, request: &[u8]) -> Result<Vec<u8>, String> {
        self.0.delete_entitlement_connect(request).await
    }
}
