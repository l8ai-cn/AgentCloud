use crate::connect_call::connect_call;
use crate::error::ApiError;
use crate::ApiClient;
use agentcloud_types::proto_entitlement_v1 as ep;

// =============================================================================
// Connect-RPC (binary wire). See proto-naming-conventions.md §2.5.
// =============================================================================
//
// Layer 1 of the two-layer authorization model. Two services, two auth
// surfaces: EntitlementService is org-scoped (org_slug at tag 1, org admin
// role) and only ever writes subject_kind "user"; EntitlementAdminService is
// platform-scoped (is_system_admin) and writes the org-level admissions.
// Keeping them apart on the wire is what stops handler drift from turning
// into privilege escalation, so the client mirrors the split rather than
// collapsing both into one procedure table.

impl ApiClient {
    pub async fn list_entitlements_connect(
        &self,
        req: &ep::ListEntitlementsRequest,
    ) -> Result<ep::ListEntitlementsResponse, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementService/ListEntitlements",
            req,
        )
        .await
    }

    pub async fn grant_member_entitlement_connect(
        &self,
        req: &ep::GrantMemberEntitlementRequest,
    ) -> Result<ep::Entitlement, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementService/GrantMemberEntitlement",
            req,
        )
        .await
    }

    pub async fn deny_member_entitlement_connect(
        &self,
        req: &ep::DenyMemberEntitlementRequest,
    ) -> Result<ep::Entitlement, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementService/DenyMemberEntitlement",
            req,
        )
        .await
    }

    pub async fn delete_member_entitlement_connect(
        &self,
        req: &ep::DeleteMemberEntitlementRequest,
    ) -> Result<ep::DeleteMemberEntitlementResponse, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementService/DeleteMemberEntitlement",
            req,
        )
        .await
    }

    pub async fn list_organization_entitlements_connect(
        &self,
        req: &ep::ListOrganizationEntitlementsRequest,
    ) -> Result<ep::ListOrganizationEntitlementsResponse, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementAdminService/ListOrganizationEntitlements",
            req,
        )
        .await
    }

    pub async fn list_resource_entitlements_connect(
        &self,
        req: &ep::ListResourceEntitlementsRequest,
    ) -> Result<ep::ListResourceEntitlementsResponse, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementAdminService/ListResourceEntitlements",
            req,
        )
        .await
    }

    pub async fn grant_entitlement_connect(
        &self,
        req: &ep::GrantEntitlementRequest,
    ) -> Result<ep::Entitlement, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementAdminService/GrantEntitlement",
            req,
        )
        .await
    }

    pub async fn deny_entitlement_connect(
        &self,
        req: &ep::DenyEntitlementRequest,
    ) -> Result<ep::Entitlement, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementAdminService/DenyEntitlement",
            req,
        )
        .await
    }

    pub async fn delete_entitlement_connect(
        &self,
        req: &ep::DeleteEntitlementRequest,
    ) -> Result<ep::DeleteEntitlementResponse, ApiError> {
        connect_call(
            self,
            "/proto.entitlement.v1.EntitlementAdminService/DeleteEntitlement",
            req,
        )
        .await
    }
}
