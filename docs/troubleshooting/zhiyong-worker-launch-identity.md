# Zhiyong 拉起 Worker 失败：身份链定位

`teacher-assistant-partner` 在 oilan 线上 `run_count = 0`，从未成功创建过 worker。
本文记录该链路的全部闸门、线上实测值，以及排除法后剩余的可能原因。

采证时间 2026-08-02，target `gw-oilan-node`，AgentCloud org `l8ai`(id=2)。

## 现象

| 观察项 | 实测值 |
|---|---|
| `experts.run_count`（teacher-assistant-partner） | 0 |
| `experts.run_count`（learning-companion-partner） | 4，最后 2026-07-27 |
| org 2 的 `pods` | 7 条，全部 do-agent，最新 2026-07-29 |
| org 2 的成员 | 3 个，其中仅 1 个 SSO principal（`testadminuser02`） |
| `orchestration_resources` / `orchestration_worker_launches` | 0 行 |

零真实教师被联邦进来，是比 `run_count=0` 更早的信号。

## 凭证模型

zhiyong 不使用服务凭证，而是**原样转发教师自己的 AMP business token**
（`agentcloud_user_endpoint.py`）。AgentCloud 用 `ampidentity` 联邦认证该 token，
worker 归属被解析出的真实用户。因此任何一道闸门失败，结果都是「一个 worker 都没有」。

## 闸门逐条核对

请求 `POST /api/v1/orgs/l8ai/experts/teacher-assistant-partner/run` 依次经过：

| # | 闸门 | 代码位置 | 失败错误 | 线上状态 |
|---|---|---|---|---|
| 1 | 路由挂 AMP 中间件 | `rest/router.go` `AuthMiddlewareWithAMPBearer` | 落回自签 JWT 校验 → 401 | 已挂 |
| 2 | 识别为 business token | `ampbearer.PeekIssuer` | `ErrNotBusinessToken` | **取决于 token** |
| 3 | issuer 形如 `.../apps/<CODE>` | `ampbearer.SplitIssuer` | `ErrIssuerShape` | **取决于 token** |
| 4 | issuer 前缀命中 SSO 配置 | `ssoConfigRepository.ListAMPBearerByIssuerPrefix` | `ErrIssuerNotConfigured` | 已配置 |
| 5 | app code 在白名单 | `ampidentity.allowsAppCode` | `ErrAppCodeNotAllowed` | `["ZHIYONG"]` |
| 6 | JWKS 验签与过期 | `ampbearer.Verifier.Verify` | `ErrSignature` | 网络可达 |
| 7 | 身份声明完整 | `ampbearer.requireIdentityClaims` | `ErrClaimsIncomplete` | **取决于 token** |
| 8 | tenant 映射到 org | `auth.resolveFederatedOrgID` | `ErrSSOTenantUnbound` / `ErrSSOTenantMismatch` | 仅绑定 tenant `6` |
| 9 | org 解析非零 | `ampidentity.federate` | `ErrOrganizationUnbound` | 依赖 #8 |

### 已就绪的服务端配置（可排除）

```
sso_configs id=1
  protocol            = oidc
  is_enabled          = true
  oidc_issuer_url     = https://amp.l8ai.cn/api/v1/public/protocols/oidc/apps/AGENTCLOUD
  amp_bearer_app_codes= ["ZHIYONG"]
  default_organization_id = 2

organizations id=2 slug=l8ai  amp_tenant_id = 6
```

issuer 前缀匹配成立：`SplitIssuer` 在 `/apps/` 处切分，token 的
`.../apps/ZHIYONG` 得到 base `.../oidc/apps/`，`LIKE base%` 命中上表的
`.../apps/AGENTCLOUD` 行，appCode `ZHIYONG` 命中白名单。

backend pod 实测可取 discovery，两个 app 均 HTTP 200：

```
ZHIYONG    discovery HTTP=200
AGENTCLOUD discovery HTTP=200
```

结论：**闸门 1、4、5、6 全部就绪，不是失败原因。** 剩余变量集中在 token 本身
（2、3、7）与租户绑定（8、9）。

## 剩余原因（按概率排序）

### A. 教师所在 AMP 租户未绑定到任何 org

`amp_tenant_id` 只在 org 2 上绑了 `6`。`resolveFederatedOrgID` 的行为是：

- token 带 tenant 且能解析 → 用解析结果，但若与 `default_organization_id` 不一致则
  `ErrSSOTenantMismatch`
- token 带 tenant 但无绑定 → `ErrSSOTenantUnbound`，**失败关闭，不回落默认 org**
- token 无 tenant → 回落 `default_organization_id`

唯一联邦成功过的用户是测试账号 `testadminuser02`，符合「只有 tenant 6 能过」的形态。
真实教师若属于其它 AMP 租户，必然卡在这里。

**判据**：token 的 `tenant_id` / `authz_tenant_id` 是否等于 `6`。

### B. principal_type 是 `api_key` 而非 `user_session`

两侧口径不一致。zhiyong 放行两种主体：

```python
if context.get("principal_type") not in {"user_session", "api_key"}:
```

AgentCloud 只接受 `user_session`，否则 `ErrClaimsIncomplete`。这是设计意图——
worker 必须归属真实用户，不允许机器主体代持。

**判据**：token 的 `principal_type`。

### C. 转发的根本不是 AMP business token

若 zhiyong 前端送的是自己签发的会话 token，`PeekIssuer` 在闸门 2 即返回
`ErrNotBusinessToken`，请求落回 AgentCloud 自签 JWT 校验并以 401 结束。

**判据**：token 的 `iss` 与 `token_use`。

## 定位步骤

取一个真实教师的 `Authorization`（**不落盘、不外传**），只解 payload：

```bash
read -rs TOK
TOK="$TOK" python3 -c "
import base64,json,os
p=os.environ['TOK'].replace('Bearer ','').split('.')[1]
p+='='*(-len(p)%4)
c=json.loads(base64.urlsafe_b64decode(p))
for k in ('iss','token_use','principal_type','app_code','tenant_id','authz_tenant_id','sub','exp'):
    print(k,'=',c.get(k))
"
```

判读：

| 字段 | 期望值 | 不符时 |
|---|---|---|
| `iss` | `https://amp.l8ai.cn/api/v1/public/protocols/oidc/apps/ZHIYONG` | 原因 C |
| `token_use` | `amp_business_access` | 原因 C |
| `principal_type` | `user_session` | 原因 B |
| `app_code` | `ZHIYONG` | 原因 C |
| `tenant_id` / `authz_tenant_id` | `6` | 原因 A |

随后用同一 token 隔离验证 AgentCloud 端，不经 zhiyong：

```bash
curl -sS -X POST \
  "https://agents.l8ai.cn/api/v1/orgs/l8ai/experts/teacher-assistant-partner/run" \
  -H "Authorization: $TOK" \
  -H "X-Organization-Slug: l8ai" \
  -H "Content-Type: application/json" \
  -d '{"alias":"smoke-ta-001","cols":120,"rows":40}' \
  -w '\nHTTP %{http_code}\n'
```

| 返回 | 判定 |
|---|---|
| 401 | 闸门 2/3/6/7 之一，看 backend 日志的 error 变量 |
| 403 | 身份通过，成员或角色不足 |
| 400 `launch_env undeclared` | LaunchEnv 契约不符，查 snapshot 15 |
| 409 | snapshot 与 catalog 不一致，重跑 bootstrap-marketplace |
| 200 + `pod_key` | 身份链打通 |

验收查询：

```sql
SELECT slug, run_count, last_run_at FROM experts
WHERE slug='teacher-assistant-partner';

SELECT id, pod_key, agent_slug, status, created_at FROM pods
WHERE organization_id=2 ORDER BY id DESC LIMIT 3;
```

## 修复方向

原因 A 是配置问题：把教师所在 AMP 租户绑定到目标 org，或确认教师本就应属 tenant 6。
跨环境租户身份不得推断，须以目标环境业务库主数据为准。

原因 B 需要决策：应让教师请求以 `user_session` 主体到达 ai-api，而不是放宽
AgentCloud 侧的主体校验——后者会破坏 worker 归属真实用户的语义。

原因 C 需要 zhiyong 侧在调用前换取 AMP business token，而非原样转发会话凭证。
禁止为兼容而并存两套凭证或加 fallback 分支。
