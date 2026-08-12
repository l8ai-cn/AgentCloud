use crate::connect_call::connect_call;
use crate::error::ApiError;
use crate::ApiClient;
use agentcloud_types::proto_extension_v1 as ext_proto;

impl ApiClient {
    pub async fn list_my_installed_skills_connect(
        &self,
        req: &ext_proto::ListMyInstalledSkillsRequest,
    ) -> Result<ext_proto::ListMyInstalledSkillsResponse, ApiError> {
        connect_call(
            self,
            "/proto.extension.v1.MyCapabilitiesService/ListMyInstalledSkills",
            req,
        )
        .await
    }

    pub async fn list_my_installed_mcp_servers_connect(
        &self,
        req: &ext_proto::ListMyInstalledMcpServersRequest,
    ) -> Result<ext_proto::ListMyInstalledMcpServersResponse, ApiError> {
        connect_call(
            self,
            "/proto.extension.v1.MyCapabilitiesService/ListMyInstalledMcpServers",
            req,
        )
        .await
    }
}
