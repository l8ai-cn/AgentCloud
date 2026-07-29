# AMP 身份直通：学生以本人身份使用 Agent Cloud（目标设定）

Status: T1 已实现（REST + session + Connect-RPC 三面，含单测）；T2/T3 本地联调中
Date: 2026-07-28
Scope: AgentCloud backend 认证中间件、clients/web 会话注入、zhiyong-lab-api/frontend 实验拉起链路
关联: `2026-07-25-amp-oidc-identity-federation-design.md`（浏览器 SSO 登录，已完成）、
`zhiyong/docs/superpowers/specs/2026-07-27-agentcloud-lab-type-design.md`（agentcloud 实验类型）

## 纲领目标

学生在 zhiyong 完成 AMP 登录后不再有第二次认证：**他手里那张 AMP 业务 access_token 被
Agent Cloud 当作一等凭证直接接受**，实验页 iframe 里跑的是这名学生本人的 Agent Cloud
会话，拉起的 worker 归属他本人，调用路径与他直接打开 Agent Cloud 前端时完全一致。

一句话判据：**链路上任何一处出现"服务账号代替学生"，目标就没达成。**

## 为什么现在不通（缺陷定位）

Agent Cloud 只把 AMP 当登录用的 IdP，没把 AMP 当凭证签发方。SSO 走完 authorization code
flow 后 AMP 的 token 被丢弃，Agent Cloud 发自己的 JWT，此后所有 API 只认自己这张 ——
中间件里**不存在**"验证一张 AMP 签的 token"的分支。于是身份只能靠浏览器三跳 302 传递，
而 302 在 iframe 和服务间调用里都用不了，最终退回 org key 代签，学生身份在这一步丢干净：

- `backend/internal/api/rest/v1/worker_embed_context.go` 的 `UserID: tenant.UserID`，在 API
  key 认证下就是这把 key 的 creator，**所有学生的 worker 与 embed 会话挂在同一个用户上**。
- 同文件 `ownedSession` 硬性要求 `session.UserID == tenant.UserID`，把"只能管自己启的
  worker"写进了 ext API 契约。
- iframe 拿到的是 redeem 出的 capability-scoped token，不是用户 JWT。

关键事实（决定方案形状）：zhiyong 学生请求携带的 token 已经是 AMP 业务 access_token
（`token_use=amp_business_access`、`app_code=ZHIYONG`、`iss=.../apps/ZHIYONG`，带 `sub`、
`tenant_id`、`roles`，见 `zhiyong/packages/zhiyong-auth-contract-go/authorization.go`），
而 Agent Cloud SSO 的身份键正是 `sub = principal:{unionId}` —— **两边同一个 sub**。所以
身份直通落到的是与浏览器 SSO 完全同一个 Agent Cloud 用户，不产生第二身份源。

## 三条轨道与完成定义

### T1 Agent Cloud 接受 AMP 凭证（resource-server 模式）

Agent Cloud 同时作为 OIDC RP（人从 AMP 登进来）与 resource server（AMP 签的凭证被直接
接受）。认证中间件新增一条 bearer 分支：`token_use=amp_business_access` → 按 `iss` 定位
已配置的 AMP sso_config → JWKS 验签 → `app_code` 命中该配置白名单 → `tenant_id` 匹配
`organizations.amp_tenant_id` → 解析 `sub` 命中或 JIT 到与 SSO 同一 user → 由 `roles` 经
`pkg/ampauthz` 映射出 `TenantContext.UserRole`。

**完成定义**：拿一张真实 ZHIYONG token 直接调 org-scoped 接口返回 200 且上下文里的
user/org/role 正确；四条护栏各有拒绝用例的自动化测试。

**已实现**（落地时确定的三个非显然取舍）：

1. **按 issuer base 前缀定位配置，而不是按 `iss` 全等**。AMP 每个应用一个 issuer
   （`.../apps/ZHIYONG` vs `.../apps/AGENTCLOUD`），token 的 `iss` 与 sso_config 存的
   `oidc_issuer_url` 永远不相等。`pkg/ampbearer.SplitIssuer` 把 issuer 切成部署 base
   （以 `/apps/` 结尾）与 app code，`sso_configs.amp_bearer_app_codes`（迁移 000237）
   是该部署下允许断言身份的应用白名单。命中多条配置即报 `ErrAmbiguousConfig` 拒绝，
   不做优先级选择 —— 配置歧义是错误，不是可推断的情况。
2. **先查配置，再联网**。`Authenticate` 在验签前完成"issuer 是否已配置"判断，攻击者
   提供的 issuer 永远不会被 Agent Cloud 请求（否则就是 SSRF）。已配置后才用 token 自己
   的 `iss` 建 provider 拉 JWKS 验签（实测同一 AMP 部署各应用共用 `kid=oidc-primary`）。
   `aud` 检查被跳过（`SkipClientIDCheck`），跨应用信任由白名单授权而非 `aud`。
3. **AMP 分支失败不回落**。路由依据是未验证的 `token_use`，所以一旦路由进 AMP 分支就
   必须以该分支的结论为准；回落到本地校验器会把伪造的 claim 变成第二次机会。

组织越权点收在 `TenantMiddleware`：AMP 身份解析出的 org 与 URL 请求的 org 不一致即 403，
这比"只校验 tenant_id 字符串"更强，因为它比对的是身份实际解析到的组织。

**Connect-RPC 同一条分支**。Agent Cloud 前端的控制台调用走 `/proto.*`，它有自己的
`interceptors.NewAuthInterceptor`，只认本地 JWT——学生 token 在这一面会 401，"和自己打开
Agent Cloud 前端完全一致"就不成立。因此拦截器接同一个 `middleware.AMPBearerAuthenticator`
（同样 AMP 分支失败不回落），并把解析出的 org 记入 context，由 `ResolveOrgScope` 比对
请求里的 `org_slug`——Connect 路径上没有 `/orgs/:slug/` 可比对，这是 REST `TenantMiddleware`
跨租户检查在 Connect 面的对等实现。

新增/改动：`pkg/ampauthz/business_token_claims.go`（claim 解码收成唯一 SSOT，
`pkg/auth/sso` 原有的私有解码器改为调用它）、`pkg/ampbearer/{issuer,verifier}.go`、
`internal/service/ampidentity/*`、`internal/middleware/amp_bearer.go`、
`AuthMiddlewareWithAMPBearer`、`internal/api/connect/interceptors/amp_bearer.go`、
`FederateIdentity`（SSO 回调与 bearer 共用同一套
user/membership 落地，保证两条路进同一个 user）。

### T2 实验在学生身份下拉起并归属学生

lab-api 不再用 org key 代替学生拉起 worker。worker 的 owner 是学生本人，`lab_instances`
仍是 zhiyong 侧映射与配额 SSOT。

**核实后修正**：原先判定"归属改了会让 ext API 的 owner-only 限制反噬回收路径"是错的。
`RunExpert` 用 `tenant.UserID` 作 owner，所以学生 bearer 打**用户面**
`POST /api/v1/orgs/{org}/experts/{slug}/run` 天然归属学生；而 ext 面的
`TerminatePod`/`GetPod` 是 org 作用域（`pods:write`/`pods:read`），**不是** owner 作用域，
owner-only 只存在于 `worker_embed_context.go` 的 embed 路径 —— 而 embed grant 正在被删除。
因此 idle reaper 继续用 org key 即可收敛学生的 worker，Agent Cloud 侧无需改动。

lab-api 因此拆成两个按主体命名的客户端：学生主体走用户面转发学生 `Authorization`；
平台主体走 ext 面带 `X-API-Key`，只用于学生不在场的生命周期职责（状态、终止、健康检查）。
这是两个授权主体而非凭证降级链：学生发起的拉起拿不到 bearer 必须显式失败，禁止回落 org key。

**完成定义**：学生拉起的 worker 在 Agent Cloud 侧 owner 为该学生用户；idle reaper 与
显式终止仍能收敛该 worker；per-user 并发配额仍生效。

### T3 iframe 内跑真人会话

`clients/web` 支持从宿主注入的 AMP 凭证建立会话，而不是只从自己的 localStorage 读
token pair。AMP 不发 refresh_token，所以需要一条 parent → iframe 的续期通道，由 zhiyong
侧在 AMP token 临期时递新值；iframe 内不得出现登录跳转。

握手契约（固定）：iframe 发 `agentcloud.embed.ready`，宿主回
`{ type: "agentcloud.embed.host-session", version: 1, accessToken, orgSlug, podKey }`，
宿主在 token 轮换时重发同一消息，iframe 不重载、不中断终端。

**真人身份不得复用 embed 路由面**：`/v1/embed/*` 由 embed token 的 capability 位授权，
处理器信任 claim 里的 session id，不做"这个用户能不能访问这个 session"的校验。把真人
凭证接到那一面上就是横向越权。真人会话必须走 `/v1` org-scoped 面，由真实成员角色与
session 权限判定。

**完成定义**：实验页 iframe 内全程零登录跳转；AMP token 过期后经宿主续期自动恢复，
不需要学生刷新页面。

## 验收：以浏览器截图为准

| # | 截图证明什么 | 判定 |
| --- | --- | --- |
| 1 | 学生在 zhiyong 实验页点开实验，iframe 内 Agent Cloud 界面的账号区显示**该学生本人** | 账号不是服务账号，且全程无第二次登录 |
| 2 | 同一学生顶层直接打开 Agent Cloud 前端（AMP 免密直通），worker 列表里能看到刚拉起的实验 worker | 归属真的落在学生身上，不是服务账号 |
| 3 | iframe 内 agent 就绪并完成一次真实交互（prompt→回复，或 terminal 有输出） | "拉起智能体实验"成立 |
| 4 | 换另一名学生打开同一实验，只看到自己的 worker | 学生间隔离 |
| 5 | 用 `tenant_id` 与组织绑定不符的 token 调用被拒的响应 | 跨租户护栏生效 |

## 护栏（少一条即视为安全洞）

1. **必须真验签**。Agent Cloud 不在 zhiyong 网关后面，不能学 lab-api 那种"网关验过了我只
   base64 解码"，必须拉 AMP JWKS 验签并校验 `iss`、有效期。
2. **`app_code` 白名单必填**。为空即拒绝，绝不默认接受任意 AMP 应用签发的 token；否则任何
   AMP 应用的 token 都能进 Agent Cloud。
3. **`tenant_id` 必须匹配 `organizations.amp_tenant_id`**。这是唯一的跨租户隔离点，不匹配
   即拒绝，不做域名/名称推断兜底。
4. **`UserRole` 语义分离**。API key 路径的 `"apikey"` 与真人路径必须区分，否则
   `requireOrgAdmin` 的判断被污染。

信任边界说明：接受 `app_code=ZHIYONG` 的 token 意味着 Agent Cloud 接受一个 AMP 从未为
AGENTCLOUD 应用授权过的身份。这是**显式的、按 sso_config 配置的信任委派**，不是漏洞，
但必须显式声明并可撤销（去掉白名单条目即断开）。

## 前置条件

- AMP tenant code 与目标环境业务库 `tenantId` 的对齐必须先核实。对不上就是跨租户串号，
  这是开工前的硬闸门，不是事后核查项。
- AMP JWKS 端点从 Agent Cloud 侧网络可达。已核实：`ZHIYONG` 与 `AGENTCLOUD` 两个应用的
  discovery 均返回 200、RS256，且 JWKS 是同一把密钥（`kid=oidc-primary`，模数一致），
  即一个 AMP 部署一把签名密钥。
- 学生会成为真实 org member：成员规模、席位与计费口径需同步确认。

## 不做的事

- 不为学生新造 Agent Cloud 本地密码账号。
- 不做 RFC 8693 完整 token exchange 端点。直通模式下没有换票步骤，不需要它。
- 不在 iframe 内跑 AMP SSO 跳转。免密直通依赖顶层会话 cookie，第三方 iframe 里被浏览器
  分区，叠加 AMP 登录页的 frame-ancestors，结果是白框或框内登录表单。
- 不动 teacher-assistant / learning-companion 现有 partner embed 链路。

## 不算完成的情形

- 仍靠 org key 代签 embed grant。
- iframe 内出现任何形式的二次登录。
- worker owner 是服务账号。
- AMP token 未验签，或靠"网关已验"假设放行。
