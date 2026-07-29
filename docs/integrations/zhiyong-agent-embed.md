# Zhiyong 嵌入 AI 学伴 / AI 教师助理

Zhiyong 前端在自己的页面里嵌入 AgentsMesh 的对话工作台，学生 / 教师直接在
zhiyong 内完成与 AI 学伴、AI 教师助理的全部交互。

嵌入有两种凭证模型：

| 模型 | iframe 入口 | 浏览器持有 | 用在 |
|---|---|---|---|
| 身份直通 host-session | `/iframe?host_session=1` | 学生自己的 AMP access token | agentcloud 实验（lab-api） |
| 组织 API Key + embed context | `/iframe?embed_context=…` | 5 分钟一次性 context | ai-api 的 copilot 面板 |

身份直通是目标模型：worker 归属真实用户、会话授权走用户自己的成员身份，宿主不再代持
能力令牌。

## 身份直通（host-session）

前置：AgentsMesh 侧把 AMP 配成 resource server —— `sso_configs` 的
`amp_bearer_app_codes` 列入宿主 app_code（如 `ZHIYONG`），组织 `amp_tenant_id`
绑定该 AMP 租户。之后同一个 AMP 用户在 AgentsMesh 里 JIT 落成同一个 user，
其 AMP access token 在 REST `/api/v1/orgs/{slug}/**`、session `/v1/**`
与 Connect-RPC 上都是一等 bearer。

```
zhiyong 后端（lab-api）            AgentsMesh                    zhiyong 浏览器
    │                                 │                              │
    │  学生 bearer 直接透传            │                              │
    ├─ POST /orgs/{org}/experts/{slug}/run ──▶ worker 归属学生        │
    │                                 │                              │
    ├──── iframe_url / org_slug / pod_key（不含凭证）──────────────▶ │
    │                                 │◀── /iframe?host_session=1 ────│
    │                                 │─── embed.ready ─────────────▶│
    │                                 │◀── host-session + 学生 token ─│
    │                                 │◀── /v1/sessions/by-pod/{key} ─│
```

iframe 把父页 origin 取自 `document.referrer`（宿主不得剥离 referrer），凭证只经
postMessage 传入、不落 URL；token 过期由宿主重新 post 一次，`pod_key` 与会话不变。

```js
iframe.src = `${iframeBase}/iframe?host_session=1`;
window.addEventListener("message", (event) => {
  if (event.origin !== new URL(iframeBase).origin) return;
  if (event.data?.type !== "agentcloud.embed.ready" || event.data?.version !== 1) return;
  iframe.contentWindow.postMessage(
    { type: "agentcloud.embed.host-session", version: 1, accessToken, orgSlug, podKey },
    new URL(iframeBase).origin,
  );
});
```

## 三段式凭证（组织 API Key 模型）

| 凭证 | 持有方 | 生命周期 | 作用 |
|---|---|---|---|
| `amk_…` API Key | zhiyong 后端 | 长效 | 拉起伙伴实例、签发 embed context |
| `embed_context` | zhiyong 前端（URL 参数） | 5 分钟，一次性 | 换取会话访问令牌 |
| `redemption_proof` | zhiyong 父页内存 | 与 context 同寿 | 证明 iframe 由本页打开 |
| `access_token` | iframe 内部 | 15 分钟 | 读写该会话，能力受 capability 限制 |

`embed_context` 与 `redemption_proof` 走两条通道（URL vs postMessage），任何一条
泄漏都不足以接管会话。

## 前置：API Key scope

在 组织设置 → API Keys 创建密钥，勾选：

- `experts:read` / `experts:write` — 列出并拉起伙伴
- `pods:read` / `pods:write` — 查询与终止实例
- `sessions:embed` — 签发浏览器嵌入凭证

## 运行时链路

```
zhiyong 后端                      AgentsMesh                    zhiyong 浏览器
    │                                 │                              │
    ├─ POST /experts/{slug}/run ─────▶│  拉起伙伴 → pod_key           │
    │                                 │                              │
    ├─ POST /workers/{key}/embed-context ──▶ embed_context + proof   │
    │                                 │                              │
    ├──────── embed_context + proof ──────────────────────────────▶ │
    │                                 │                              │
    │                                 │◀── /iframe.html?embed_context │
    │                                 │─── inspect → parent_origins ▶│
    │                                 │◀── ready / open + proof ────▶│
    │                                 │◀── redeem → access_token ────│
```

### 1. 拉起伙伴实例

```bash
curl -X POST "$API/ext/orgs/$ORG/experts/learning-companion-partner/run" \
  -H "X-API-Key: $AGENTCLOUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"alias":"student-1001","cols":120,"rows":40}'
# → { "pod": { "pod_key": "1-standalone-…", "interaction_mode": "acp", … } }
```

教师助理换成 `teacher-assistant-partner`。`alias` 必须由租户 + 用户（学伴再加课程）
稳定派生：宿主每次先 `GET /workers` 按 alias 找已存在实例，找不到才 `run`。实例归属
以 AgentsMesh 为准，宿主侧不要另存一份 `pod_key`——实例被回收后缓存会指向死 pod。

### 2. 签发嵌入凭证

```bash
curl -X POST "$API/ext/orgs/$ORG/workers/$POD_KEY/embed-context" \
  -H "X-API-Key: $AGENTCLOUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_origins": ["https://zhiyong.example"],
    "capabilities": ["read", "write", "control", "approve"]
  }'
# → { embed_context, redemption_proof, expires_at, session_id, pod_key }
```

`parent_origins` 必须是精确 origin（不含路径、查询、通配符）。capability 语义：

| capability | 授予 |
|---|---|
| `read` | 必选；查看会话、产物、文件 |
| `write` | 发消息、上传附件 |
| `control` | 中断、停止会话 |
| `approve` | 处理权限审批弹窗 |
| `terminal` | 终端列表；与 `control` 同时具备才可连 PTY |

**签发边界**：API Key 只能为自己拉起的实例签发。跨用户共享会话仍走用户 JWT 的
`POST /v1/sessions/{id}/embed-context`，那条路径才走完整的会话授权模型。

### 3. 宿主页握手

`embed_context` 放 URL、`redemption_proof` 只留内存，两者不要同时下发到同一通道。

```html
<div id="agent-host" style="height: 640px"></div>
<script>
async function mountAgent(podKey) {
  const grant = await fetch(`/zhiyong-api/agent/embed?pod=${podKey}`).then((r) => r.json());
  const iframeBase = "https://agents.l8ai.cn";
  const iframe = document.createElement("iframe");
  iframe.src = `${iframeBase}/iframe.html?embed_context=${encodeURIComponent(grant.embed_context)}`;
  iframe.style.cssText = "width:100%;height:100%;border:0";
  iframe.allow = "clipboard-write";
  document.getElementById("agent-host").appendChild(iframe);

  window.addEventListener("message", function onReady(event) {
    if (event.origin !== new URL(iframeBase).origin) return;
    if (event.source !== iframe.contentWindow) return;
    if (event.data?.type !== "agentcloud.embed.ready" || event.data?.version !== 1) return;
    iframe.contentWindow.postMessage(
      { type: "agentcloud.embed.open", version: 1, redemptionProof: grant.redemption_proof },
      new URL(iframeBase).origin,
    );
    window.removeEventListener("message", onReady);
  });
}
</script>
```

`/zhiyong-api/agent/embed` 是 zhiyong 自己的后端接口：内部完成"取该学生的 pod_key
（没有则先 run）→ 调 embed-context → 返回 grant"，API Key 全程不出后端。

## 学伴领域 API（skill HTTP → interface proxy）

学伴知识图谱 / Wiki / practice 由 worker 内 `learning-companion` skill 的领域 HTTP
服务拥有（Unix socket：`$WORKSPACE/.agent/run/learning-companion.sock`）。zhiyong
ai-api 只做鉴权、ensure worker、再转发到 AgentsMesh：

```bash
# 健康检查
curl "$API/ext/orgs/$ORG/workers/$POD_KEY/interfaces/learning-companion/health" \
  -H "X-API-Key: $AGENTCLOUD_API_KEY"
# → {"status":"ok","service":"learning-companion",…}

# 领域读（snapshot / graph / wiki page）
curl "$API/ext/orgs/$ORG/workers/$POD_KEY/interfaces/learning-companion/workspace" \
  -H "X-API-Key: $AGENTCLOUD_API_KEY"
curl "$API/ext/orgs/$ORG/workers/$POD_KEY/interfaces/learning-companion/graph/layers" \
  -H "X-API-Key: $AGENTCLOUD_API_KEY"

# 列出已就绪 interface
curl "$API/ext/orgs/$ORG/workers/$POD_KEY/interfaces" \
  -H "X-API-Key: $AGENTCLOUD_API_KEY"
```

需要 `pods:read`。pod 未活返回 409；socket 未起返回 503。

通用沙箱读（`workspace/search` / `workspace/files`）仍可用，但学伴领域 UI **不要**
再用它们在 host 拼 snapshot——一律走 interface proxy。

## 部署要求

嵌入用的 UI 是 `clients/web` 的 Next.js 路由 `/iframe`（兼容 `/iframe.html`），
由 `@agent-cloud/agent-ui` 驱动 AgentWorkspace。生产 base：`https://agents.l8ai.cn`。

- **iframe（跨域，推荐）**：iframe 宿主与 AgentsMesh API 同域（`agents.l8ai.cn`），
  该 origin 需要能访问 `/v1` 与 Connect 端点（Traefik 已路由）。
- **同域挂载**：引入 embed 模块并调 `mountEmbeddedAgentWorkspace`，由
  zhiyong 后端代理短期 access token。

## 会话续期

`access_token` 15 分钟过期。长课时场景由 zhiyong 前端在过期前重新向自己后端要一份
新的 grant 并重建 iframe；`pod_key` 不变，会话与工作区连续。

## 排错

| 现象 | 原因 |
|---|---|
| 403 `INSUFFICIENT_SCOPE` | API Key 缺 `sessions:embed` |
| 403 `ACCESS_DENIED` | 该 Worker 不是这把 Key 拉起的 |
| 404 `RESOURCE_NOT_FOUND` | pod_key 不存在，或属于其它组织 |
| 409 `Worker is not active` | 实例已停止，先按 alias 重新 `run` 再签发 |
| 503 `runner_unavailable`（workspace 读取） | 该实例所在 runner 未连上，工作区读不到 |
| 400 `parent_origins must contain exact…` | origin 带了路径 / 通配符 |
| iframe 停在 ready 不前进 | 父页 origin 不在 `parent_origins` 里，或 proof 未回传 |
| redeem 返回 401 | context 已被兑换过或已过期（5 分钟） |
| host-session iframe 直接报错、没发 ready | 宿主剥掉了 referrer，iframe 拿不到父页 origin |
| 带 AMP token 请求返回 401 | 该 app_code 不在 `sso_configs.amp_bearer_app_codes`，或 JWKS 不可达 |
| 403 `organization is outside the authenticated tenant` | token 的 AMP 租户与目标组织 `amp_tenant_id` 不是同一个 |
| 204 `/v1/sessions/by-pod/{key}` | worker 还没有会话，等 runner 起会话或重新 run |
