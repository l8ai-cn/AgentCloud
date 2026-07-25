# AMP OIDC 身份联邦详细设计（首客户 zhiyong 接入 · 第一步）

Status: Design
Date: 2026-07-25
Scope: AgentCloud backend SSO/OIDC 打通 AMP（https://amp.l8ai.cn），实现 AMP 优先登录 + 组织落位。
Out of scope: AI 助手会话迁移、内嵌 dock、token 交换接口、zhiyong 业务工具回调。

## 1. 目标

一条可验收的纵向链路：zhiyong 用户从 AMP 身份直接登录 AgentCloud，落进指定组织，本地密码登录保留为显式第二入口。

不新造认证体系。AMP 是 OIDC Provider，AgentCloud 已有域名键控的 OIDC SSO + JIT 建号，本设计只补齐两者之间的协议差与组织落位。

## 2. 现状核实结论（含实测证据）

### 2.1 AMP 是 OIDC IdP，但契约比标准更严

AMP 自研 OAuth2/OIDC 协议栈（非 Spring Authorization Server），端点按 `appCode` 分片。已确认部署配置：

```
AMP_AUTHZ_MAIN_DOMAIN_ORIGIN = https://amp.l8ai.cn   # oilan namespace, configmap amp-backend-config
AMP_AUTHZ_DOMAIN_PATH_PREFIX = /
```

因此 issuer 由 `OidcIssuerResolutionService.buildIssuer` 推导为：

```
https://amp.l8ai.cn/api/v1/public/protocols/oidc/apps/{APPCODE}
```

discovery / authorize / token / userinfo / jwks 都是 issuer 的直接子路径，`{issuer}/.well-known/openid-configuration` 符合标准发现约定，`go-oidc` 的 `oidc.NewProvider(ctx, issuer)` 可直接用。

### 2.2 AMP 对 OIDC profile 的四个硬约束

`PublicOauth2AuthorizeService.requireOidcSpaAuthorizeParams`（amp-authz，L576-614）对 `profile == OIDC` 强制要求：

| 参数 | 约束 | 缺失后果 |
|---|---|---|
| `state` | 必填 | 400 invalid_request |
| `nonce` | **必填** | 400 invalid_request |
| `code_challenge` | **必填** | 400 invalid_request |
| `code_challenge_method` | **必须 S256** | 400 invalid_request |

token 端点 `validatePkce`（L471-496）对 OIDC profile 同样强制 `code_verifier`。

AgentCloud 当前 `OIDCProvider.GetAuthURL` 只传 `state`（`backend/pkg/auth/sso/oidc.go:60` 的 `p.oauth2.AuthCodeURL(state)`）。**这是第一个硬阻塞：不补 nonce + PKCE，authorize 一步都走不通。**

### 2.3 浏览器顶层跳转可行

`PublicOauth2AuthorizeService.authorize` L258-267：无 `session_token` 且无 `Authorization` 头时返回 `buildLoginRedirect`，即 302 到 AMP 自己的 `/login?appCode=&tenantId=&returnTo=`。所以 AgentCloud 的 307 顶层重定向能正常落到 AMP 登录页；用户已有 AMP 共享会话时免密直回。这条与 zhiyong 前端现有 `buildEcpLoginUrl` 行为一致。

### 2.4 tenantId 必须显式传

L272-275 与 `requireTargetApplicationBinding`：`targetTenantId` 为空直接 401 `access_denied`。取值优先级是 authorize 上的 `tenantId` 查询参数 → redirect 域名反查租户 → 会话租户。AgentCloud 的 redirect 域名不会登记为 AMP 租户域，反查必然为空，只能靠显式 `tenantId` 或会话租户兜底。

AgentCloud 当前无法在 authorize URL 上追加任意参数。**第二个硬阻塞。**

### 2.5 sub 稳定，但 email 可能缺失

`sub` 恒为 `principal:{unionId}`（`PrincipalIdentityService.requireSubject:59`、`AppLoginSessionStateSupport:389`、`AppLoginResponseAssembler:200`），跨租户共享登录也走同一格式，可以安全当唯一键。

`email` 是**条件性 claim**（`addProfileClaims:559`）——AMP 账号没有邮箱时不下发。而 AgentCloud 的 `oidc.go:98-100` 在 email 为空时**硬失败**。zhiyong 存在学号型账号，**第三个硬阻塞。**

`email_verified` 在 AMP 侧是硬编码 `true`（`addProfileClaims:561`、`PublicOauth2UserInfoService:107`），不代表真实验证，不可作为账号合并的信任依据。

### 2.6 AgentCloud 侧缺组织落位

`sso_configs` 只有 `domain`（`backend/internal/domain/sso/sso.go:13-47`），无任何组织字段。`SSOLogin` 以 `orgID=0` 发 token，JIT 用户零组织，前端 `resolvePostLoginUrlLight` 会把人丢到 `/onboarding`。**第四个缺口。**

### 2.7 无需改动的部分

- 前端登录页已泛化：`SSOSection.tsx` 按 Discover 返回的 config 渲染 "Sign in with {name}" 并跳 `/api/v1/auth/sso/{domain}/{protocol}`。**第一期前端零改动。**
- `GetOrCreateByOAuth` 已按 `(provider, provider_user_id)` 键控，email 为空时自动合成占位邮箱（`user_oauth.go:43-45`）。
- web-admin 已有 SSO 配置 CRUD 界面（`clients/web-admin/src/app/(dashboard)/sso/`）。
- `enforce_sso` 收紧密码登录的机制已存在。

### 2.8 当前环境阻塞（非本设计问题）

`amp.l8ai.cn` 由 `gw-oilan-node` 的 `oilan` namespace `amp-public` ingress 服务（与 `amp.aiedulab.cn`、`amp.zy.oilan.ai` 共用）。实测 `/` 返回 200，`/api/**` 全部 502：

```
amp-backend-5d75797774-5scq8   0/1   CrashLoopBackOff
Caused by: java.sql.SQLException: Access denied for user 'root'@'10.42.0.224' (using password: YES)
  at cn.l8ai.authz.security.CasbinConfig.casbinEnforcer(CasbinConfig.java:36)
```

`SPRING_DATASOURCE_URL` 指向 `mysql-lctn1.test.svc.cluster.local:3306/amp`，口令与实例不匹配。AMP 侧 helm release 正在迭代（v4，几分钟前）。**联调验证需等 amp-backend 恢复。**

## 3. 设计决策

### D1 PKCE/nonce 的暂存位置 —— 独立 Redis 命名空间

`oauth:state:{state}` 的 value 是纯 redirect URL 字符串，被 GitHub/Google/GitLab/Gitee 四条 OAuth 链路共用。改成 JSON 会污染共享契约。

采用与现有 SAML 完全对称的旁路：`service/sso/auth.go` 已有 `storeSAMLRequestID` / `retrieveSAMLRequestID`（`saml:reqid:{state}`）的先例。新增 `sso:oidc:pkce:{state}` → `{verifier, nonce}`，TTL 10 分钟，与 state TTL 对齐。

与 SAML 的关键差异：SAML 在 `redis == nil` 时静默降级；PKCE **不允许降级**——AMP 强制校验，拿不到 verifier 必须硬失败，否则会在 token 交换阶段抛出难以定位的 `invalid_grant`。

### D2 Provider 接口不动，OIDC 走协议特化分支

`Provider.GetAuthURL(ctx, state)` 被 SAML/LDAP 共享。`Service.GetAuthURL` 里 SAML 已经是特化分支（跳过接口，直接调 `buildSAMLProvider` + `GetAuthURLWithRequestID`）。OIDC 沿用同一形状：新增 OIDC 分支调 `GetAuthURLWithPKCE`。

回调方向零接口变更：`HandleCallback(ctx, params map[string]string)` 本来就是 map，追加 `code_verifier` / `nonce` 两个 key 即可。

### D3 tenantId 用通用 extra-params，不加 AMP 专属列

AgentCloud 的 SSO 模型是通用的，不应该出现 `amp_tenant_id` 这种供应商专属列。新增 `oidc_authorize_extra_params JSONB DEFAULT '{}'`，AMP 场景填 `{"tenantId": "<authzTenantId>"}`。后续任何 IdP 的私有 authorize 参数都走这里。

安全约束：只允许追加，禁止覆盖 `state` / `nonce` / `code_challenge` / `code_challenge_method` / `client_id` / `redirect_uri` / `response_type` / `scope` 这些协议保留参数。

### D4 email 缺失时放行，占位邮箱交给 user service

删除 `oidc.go` 里的 email 硬校验，只保留 `sub` 必填。`GetOrCreateByOAuth` 已有占位邮箱逻辑，不需要新代码。

### D5 不信任 AMP 的 email_verified

AMP 的 `email_verified` 是硬编码常量。若据此把 AMP 断言的邮箱自动合并到 AgentCloud 已有账号，等于把账号接管权交给任意 AMP 租户管理员。

第一期保持现状：JIT 用户 `is_email_verified = false`，只在**AgentCloud 侧已验证**的邮箱上自动 link（这是既有的全局 OAuth 行为）。跨体系账号合并走第二期的显式绑定流程。

残留风险：AgentCloud 已存在同邮箱且已验证的账号时仍会自动 link。缓解是只对客户自有域名开启该 SSO 配置，并在开启前与客户核对该域名下的既有账号。

### D6 组织落位 —— sso_configs 加 default_organization_id

登录成功后若该字段非空且用户尚未在该组织内，以 `member` 角色补一条 `organization_members`。

不引入 `default_member_role` 列（YAGNI，首客户就是 member）。不改 token 生成：`SSOLogin` 继续发 `orgID=0`，与所有其它登录路径一致；补上成员关系后前端 `resolvePostLoginUrlLight` 自然能解析出组织。

不做 IdP group → 角色映射（AMP id_token 不下发 roles/groups，角色留在 AgentCloud 自管）。

### D7 第一期入口用深链，绕开邮箱域发现

AgentCloud 的 SSO 入口键控在邮箱域上。zhiyong 存在无邮箱账号，靠"输入邮箱触发 Discover"不可靠。

`GET /api/v1/auth/sso/{domain}/oidc` 本来就是无鉴权的浏览器 GET，zhiyong 侧直接深链即可，**零改动**：

```
https://<agentcloud-host>/api/v1/auth/sso/zhiyong.com/oidc?redirect=<agentcloud-frontend-callback>
```

此处 `domain` 只是配置查找键，不要求用户真的持有该域邮箱。邮箱域 Discover 作为直达 AgentCloud 登录页用户的次要路径保留。

### D8 token 端点认证方式固定为 client_secret_post

AMP 的 `buildConventionOidcClientConfig` 在没有显式 `oidc` 配置块时返回 `tokenEndpointAuthMethod = "none"`（公共客户端），并触发 `dynamicPublicOidcRedirect` —— 该路径要求 redirect_uri 必须是已登记的租户域名，AgentCloud 不满足。

所以 AMP 侧必须登记显式 `oidc` 块（clientId + clientSecret + redirectUri），走机密客户端。AgentCloud 侧显式设置 `AuthStyle: oauth2.AuthStyleInParams`，避免 `AuthStyleAutoDetect` 的首次探测失败噪声。

## 4. 数据模型变更

Migration `000233_sso_config_org_binding_and_authorize_params`：

```sql
ALTER TABLE sso_configs
  ADD COLUMN default_organization_id BIGINT NULL REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN oidc_authorize_extra_params JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_sso_configs_default_org ON sso_configs(default_organization_id)
  WHERE default_organization_id IS NOT NULL;
```

domain model `sso.Config` 同步加两个字段；`sso_admin.proto` 与 web-admin 的 `oidc-section.tsx` 暴露这两项（extra params 用 key/value 列表编辑）。

## 5. 代码变更清单

### backend/pkg/auth/sso/oidc.go
- `OIDCConfig` 增 `AuthorizeExtraParams map[string]string`。
- oauth2 `Endpoint.AuthStyle = oauth2.AuthStyleInParams`。
- 新增 `GetAuthURLWithPKCE(ctx, state, nonce, codeChallenge string) (string, error)`：`AuthCodeURL` + `oauth2.SetAuthURLParam` 追加 `nonce` / `code_challenge` / `code_challenge_method=S256` / 白名单过滤后的 extra params。
- `HandleCallback`：读 `params["code_verifier"]` 并作为 `oauth2.VerifierOption` 传入 `Exchange`；验证 `idToken.Nonce == params["nonce"]`（go-oidc 不自动校验 nonce）；解析 `tenant_id` claim 并回填到 `UserInfo`；**移除 email 硬校验**。
- `UserInfo` 增 `TenantID string`（诊断与后续租户映射用，第一期只落日志）。

### backend/internal/service/sso/
- `auth.go`：`GetAuthURL` 增 OIDC 分支——生成 nonce（32 字节随机）+ code_verifier（`oauth2.GenerateVerifier()`）→ 存 `sso:oidc:pkce:{state}` → 调 `GetAuthURLWithPKCE`。`HandleCallback` 增 OIDC 分支——`GetDel` 取回 verifier/nonce 注入 params，缺失即报错。
- `auth_provider.go`：`buildOIDCProvider` 传递 `AuthorizeExtraParams`。
- 新增 `pkce_store.go`（承载 D1 的存取，保持 `auth.go` 在 200 行内）。

### backend/internal/service/auth/auth_sso.go
- `SSOLoginRequest` 增 `DefaultOrganizationID *int64`。
- `SSOLogin` 在 `GenerateTokenPair` 之前调用组织落位（幂等：先查成员再 `AddMember`，落位失败只告警不阻断登录）。

### backend/internal/api/rest/v1/auth_sso.go
- `authenticateSSO` 从 config 读 `DefaultOrganizationID` 并透传。需要 `HandleCallback` 一并回传 config（当前只回 `configID`）。

### 测试
- `oidc_pkce_test.go`：authorize URL 含四个必需参数、S256 正确、extra params 白名单过滤、保留参数不可被覆盖。
- `oidc_callback_test.go`：verifier 缺失硬失败、nonce 不匹配拒绝、email 缺失仍能登录、tenant_id 解析。
- `auth_sso_org_binding_test.go`：首登落组、重复登录不重复落组、组织不存在时登录仍成功。
- Migration 测试：`000233` up/down 幂等。

## 6. AMP 侧配置（需 AMP 管理员执行）

在 AMP 管理台创建应用（或 `POST /api/v1/applications`），`applicationConfig.auth.oidc` 显式配置：

| 项 | 值 |
|---|---|
| appCode | `AGENTCLOUD`（待定，需 AMP 侧确认可用） |
| clientId / clientSecret | AMP 自动生成 `cid_*` / `asc_*` |
| redirectUri | `https://<agentcloud-host>/api/v1/auth/sso/zhiyong.com/oidc/callback` |
| tokenEndpointAuthMethod | `client_secret_post` |
| 租户绑定 | `POST /api/v1/applications/AGENTCLOUD/tenant-bindings`，绑定 zhiyong 的 authzTenantId |

AgentCloud web-admin 侧对应填入：

| 字段 | 值 |
|---|---|
| domain | `zhiyong.com`（配置查找键） |
| protocol | `oidc` |
| oidc_issuer_url | `https://amp.l8ai.cn/api/v1/public/protocols/oidc/apps/AGENTCLOUD` |
| oidc_client_id / secret | 上表 |
| oidc_scopes | `openid profile email` |
| oidc_authorize_extra_params | `{"tenantId": "<zhiyong authzTenantId>"}` |
| default_organization_id | zhiyong 组织 ID |
| enforce_sso | 第一期 `false`，验证通过后再收紧 |

## 7. 时序

```
浏览器 --深链--> AgentCloud GET /api/v1/auth/sso/zhiyong.com/oidc
  AgentCloud: 生成 state(Redis) + nonce + code_verifier(Redis)
  307 --> https://amp.l8ai.cn/.../apps/AGENTCLOUD/authorize
          ?response_type=code&client_id&redirect_uri&scope&state&nonce
          &code_challenge&code_challenge_method=S256&tenantId

AMP: 无会话 --302--> /login?appCode&tenantId&returnTo   (有共享会话则跳过)
用户在 AMP 完成登录 --> 回到 authorize --> 302 回 AgentCloud callback?code&state

AgentCloud GET /callback:
  ValidateOAuthState(state) -> redirectTo
  GetDel sso:oidc:pkce:{state} -> verifier, nonce
  POST {issuer}/token  (code + code_verifier + client_secret_post)
  验证 id_token: 签名(JWKS/RS256) + iss + aud=client_id + nonce
  sub=principal:{unionId} --> user_identities(sso_oidc_{id}, sub) --> JIT 建号
  default_organization_id --> AddMember(role=member) 幂等
  发 AgentCloud token pair --> 307 回前端 /auth/sso/callback?token&refresh_token
```

## 8. 风险与开放问题

| # | 项 | 影响 | 处置 |
|---|---|---|---|
| R1 | amp-backend CrashLoopBackOff（MySQL root 认证失败） | 联调全阻塞 | AMP 侧修复 DB 凭据后再验证；代码改动可并行 |
| R2 | AgentCloud 需要一个 zhiyong 可达的公网地址 | redirect_uri 无法登记 | 待定：复用现有域名还是新开 |
| R3 | zhiyong 的 authzTenantId 具体值 | authorize 401 | 需 AMP/zhiyong 侧提供 |
| R4 | appCode 命名 | 需 AMP 侧确认未占用 | 待确认 |
| R5 | AMP 无 refresh_token、无 end_session | 无法 RP 发起登出、无静默续期 | AgentCloud 自发 token（24h）已覆盖续期；登出只清本地会话，可选跳 `amp.l8ai.cn/logout?returnTo=` |
| R6 | AMP access_token 是业务 JWT（含 roles） | 已启用角色同步 | 登录时解析 access_token.roles → organization_members；细权限走本地 authz catalog（`/authz/*.yaml` + `pkg/ampauthz`），与 AMP bundle 对齐 |
| R7 | `sso_oidc_{configID}` provider 名编码了配置 ID | 重建配置会导致同一 IdP sub 产生新用户 | 记录约束：配置只改不删；后续可迁到稳定 provider key |
| R8 | AMP 可能按租户主域重写 canonical host | discovery issuer 不匹配 | 已确认本部署 `AMP_AUTHZ_MAIN_DOMAIN_ORIGIN=https://amp.l8ai.cn`；若 zhiyong 租户配了 PRIMARY 域名绑定需重新取 issuer |

## 9. 验收（浏览器实测）

1. 深链进入 → 落 AMP 登录页 → 登录 → 回跳 AgentCloud 并进入 dashboard，不经过 `/onboarding`。
2. 该用户出现在 zhiyong 组织成员列表，角色 `member`。
3. 二次登录复用同一 AgentCloud 用户（`user_identities` 无新增行，`organization_members` 无重复）。
4. 已有 AMP 共享会话时免密直通。
5. 无邮箱的 AMP 账号可登录，落占位邮箱。
6. 篡改 `state` / 丢弃 `code_verifier` → 登录失败且不建号。
7. `enforce_sso=true` 后该域密码登录返回 SSO 提示。
8. AMP 不可用（当前 502 态）时登录页给出可读错误，不白屏。
