use agentcloud_types::proto_extension_v1 as ext_proto;
use prost::Message;

use super::ExtensionService;

impl ExtensionService {
    pub async fn list_my_installed_skills_connect(
        &self,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, String> {
        let req = ext_proto::ListMyInstalledSkillsRequest::decode(request_bytes)
            .map_err(|e| format!("decode list_my_installed_skills request: {e}"))?;
        tracing::debug!(target: "extension", org_slug = %req.org_slug, "list my installed skills");
        let resp = self
            .client
            .list_my_installed_skills_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }

    pub async fn list_my_installed_mcp_servers_connect(
        &self,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, String> {
        let req = ext_proto::ListMyInstalledMcpServersRequest::decode(request_bytes)
            .map_err(|e| format!("decode list_my_installed_mcp_servers request: {e}"))?;
        tracing::debug!(target: "extension", org_slug = %req.org_slug, "list my installed mcp servers");
        let resp = self
            .client
            .list_my_installed_mcp_servers_connect(&req)
            .await
            .map_err(crate::wire)?;
        Ok(resp.encode_to_vec())
    }
}
