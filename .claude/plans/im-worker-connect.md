# IM 连接板块：让用户从微信 / 飞书 / 钉钉直接操作 Worker

调研对象：OpenClaw 的 Channel 子系统
落地对象：AgentsMesh `backend/internal/service/imbridge` + 新增「连接」前端板块

---

## 1. OpenClaw 是怎么做的

### 1.1 分层

```
Messaging Platform  ←→  Channel Adapter  →  Gateway  →  Router  →  Session  →  Agent
   (飞书/钉钉/微信)      (认证/归一化/投递)   (控制面)   (路由绑定)  (会话上下文)  (执行)
```

Channel 在 OpenClaw 里是**插件**，只负责 5 件事：平台认证、inbound 归一化、outbound 投递、平台特性（媒体/表情/线程）、访问控制。业务语义（会话、路由、指令、流式策略）全部上提到 Gateway 共享层。这个边界是 OpenClaw 后来做 "Channel Broker" 重构（PR #86096 起的一整个 stack）的核心动机——他们发现 sessions / allowlists / routing / streaming / 重试 / 审计这些语义在每个 channel 插件里各写一遍会反复回归。

**对我们的直接启示**：`Provider` 接口只该管协议，不该管路由和会话。我们现在的 `Provider` 接口边界是对的，但共享层几乎不存在。

### 1.2 值得移植的 12 个机制

| 机制 | OpenClaw 做法 | 我们是否需要 |
|---|---|---|
| Provider 插件注册 | `channels.<name>` + plugin SDK | ✅ 已有 |
| 传输双模 | webhook / 长连接（飞书 WS、钉钉 Stream） | ✅ 必需（国内客户无公网） |
| 多账号 | `channels.x.accounts.<id>` | ⬜ 后置 |
| 访问白名单 | `allowFrom` 支持 `*` / userID / `user:name` / 手机号 | ✅ 必需 |
| DM 策略 | `dmPolicy`：陌生人需配对 | ✅ 必需（当前是越权状态） |
| 群策略 | `groupPolicy: open/allowlist/disabled` + `requireMention` | ✅ 必需 |
| 配对流程 | 首次 DM 发配对码 → 管理员批准 → 落 allowlist | ✅ 身份绑定的正解 |
| 多 Agent 路由 | `routing.bindings[].match{channel,peer{kind,id}} → agentId` | ✅ **这就是「操作各种 worker」** |
| 会话键作用域 | 按 channel + peer + thread 生成 session key，按类型 idle 重置 | ✅ 复用 Channel 承载 |
| 斜杠指令 | `/status` `/new` `/reset` `/compact` `/think` `/verbose` | ✅ 必需（运维态） |
| 流式回复 | `partial` / `block` / `progress` 三模式 + progress draft 原地改消息 | ✅ 长任务必需 |
| 投递可靠性 | chunking（平台字数上限）、dedupe、durable final send、退避重试、reply fence | ✅ 必需 |

### 1.3 各平台传输模式（OpenClaw 的实践结论）

| 平台 | 官方支持度 | 推荐传输 | 说明 |
|---|---|---|---|
| 飞书 / Lark | 高 | **WebSocket 长连接** | 稳定性最好，无需公网；同一套插件靠 `domain: lark` 切国际版 |
| 钉钉 | 中（社区插件） | **Stream 模式（WS）** | 无需公网 IP/域名，Gateway 主动连；支持 AI Card 流式回复 |
| 企业微信 | 中 | webhook / 自建应用 | 回调是 AES 加密 XML，非 JSON |
| 个人微信 | 低（有风险） | 插件 + 扫码登录 | 官方 ClawBot 或第三方，有封号风险 |

钉钉那条最关键：OpenClaw 明确把 **Stream 模式**作为推荐路径，理由是「适合在 NAT 或企业防火墙后的自托管部署，Gateway 自动维护连接并处理断线重连（指数退避）」。我们的客户画像一致。

---

## 2. AgentsMesh 现状与差距

### 2.1 已有资产

| 能力 | 位置 |
|---|---|
| Provider 注册表 + 5 个 provider | `backend/internal/service/imbridge/providers.go`、`registry.go` |
| 连接 CRUD + webhook token | `service.go`、`backend/internal/domain/imbridge/connection.go` |
| webhook 入口（无 JWT，token 校验） | `backend/internal/api/rest/v1/webhooks/im_bridge.go` |
| thread → channel 映射 | `im_thread_mappings` 表 |
| 个人微信扫码 + 长轮询 | `weixin_ilink.go`、`weixin_login.go`、`weixin_monitor.go` |
| Channel → worker 提示词投递 | `backend/internal/service/channel/hook_pod_prompt.go` |
| worker 回流通道 | runner MCP `send_channel_message` |
| 管理页（设置页 tab） | `clients/web/src/components/settings/organization/IMChannelsSettings.tsx` |

架构骨架是对的：**IM 会话映射到 Channel，Channel 已经具备 worker 路由、历史、成员、审计**。不需要另造一套会话模型。

### 2.2 阻断性缺陷（必须先修）

**① IM 用户完全无法驱动 worker —— 核心功能缺失**

`bridge.go` 的 `textContent()` 只产出 `InlineText`：

```193:205:backend/internal/service/imbridge/bridge.go
func textContent(text string) channelDomain.MessageContent {
	return channelDomain.MessageContent{
		SchemaVersion: 1,
		Kind:          "text",
		Blocks: []channelDomain.Block{{
			Type: "paragraph",
			Elements: []channelDomain.InlineElement{{
				Type: channelDomain.InlineText,
				Text: text,
			}},
		}},
	}
}
```

而 `extractMentions` 只认结构化 `InlineMention` 元素（`message_extract.go:105-112`）。结论：用户在飞书里打 `@code-reviewer 看下这个 PR`，落到 channel 就是一段纯文本，`PodPromptHook` 永远不触发，worker 收不到任何提示词。**今天这条链路是断的。**

**② 所有 inbound 消息都记在连接创建者名下 —— 越权 + 审计失真**

```98:98:backend/internal/service/imbridge/bridge.go
	_, err = b.channels.SendMessageAsUser(WithSkipOutbound(ctx), channelID, conn.CreatedByUserID, content)
```

任何能给机器人发消息的人（包括外部群成员）都以管理员身份在组织内说话。没有 IM 用户 → 平台用户的映射表。

**③ 飞书 token 校验被静默绕过**

飞书 v2 事件把 `token` 放在 `header.token`，代码读顶层 `token`：

```99:108:backend/internal/service/imbridge/providers.go
	var envelope struct {
		Token string `json:"token"`
		Type  string `json:"type"`
	}
	// ...
	if envelope.Token != "" && envelope.Token != cfg.VerificationToken {
		return errors.New("feishu verification token mismatch")
	}
```

v2 事件下 `envelope.Token` 恒为空 → 比对被跳过。另外 `encrypt_key` 收进了配置但 `ParseInbound` 从不解密 `encrypt` 字段，一旦在飞书后台开启加密推送就直接解析失败。

**④ 钉钉签名算法错误 —— 配了 `signing_secret` 就 100% 拒收**

钉钉规范是 `base64(HmacSHA256(key=appSecret, msg=timestamp+"\n"+appSecret))`，代码用的是 hex：

```232:236:backend/internal/service/imbridge/providers.go
	mac := hmac.New(sha256.New, []byte(cfg.SigningSecret))
	mac.Write([]byte(ts + "\n" + cfg.SigningSecret))
	expected := hex.EncodeToString(mac.Sum(nil))
	if sign != expected {
		return errors.New("dingtalk signature mismatch")
	}
```

**⑤ 企业微信 inbound 基本不可用**：`VerifyWebhook` 直接 `return nil`（零校验），且企微回调是 AES 加密 XML，代码按 JSON 解析。

**⑥ 出站扇出会串台**：`OutboundHook` 对每条 channel 消息全表扫 `ListConnections(orgID)`，再对每个匹配连接发送。同一 org 多连接时存在跨连接串台风险，且是 per-message N+1。

**⑦ 凭据明文落库**：`im_channel_connections.config` 是明文 JSONB，里面装着 `app_secret` / `bot_token` / `corp_secret`。同仓库的 `airesource` 已有 AES-GCM 加密范式（`backend/internal/service/airesource/credentials.go` + `backend/pkg/crypto`），IM 没跟上。

**⑧ 无幂等去重**：飞书/钉钉/企微在未及时收到 200 时都会重试推送。当前没有 `external_message_id` 去重，重试会让 worker 收到重复提示词、重复执行。

### 2.3 能力缺口（新建）

无访问控制（allowlist / dmPolicy / groupPolicy / requireMention）、无斜杠指令、无 worker 路由绑定、无分片与平台字数上限处理、无流式/进度回显、无长连接传输、无连接健康探测。

---

## 3. 目标体验

用户视角（以飞书为例，钉钉/企微同构）：

1. 管理员在 web「连接」板块选飞书 → 填 App ID/Secret → 拿到回调地址或直接选长连接 → 状态变绿。
2. 管理员配路由：`#研发群 → code-reviewer`、`DM → 默认助理`、`#运维群 → 多 worker（需 @）`。
3. 成员首次私聊机器人 → 机器人回配对码 → 成员在 web 个人设置里输入 → 身份绑定完成。
4. 成员在群里 `@机器人 帮我 review !123`，或在已绑定 worker 的群直接说话。
5. worker 执行期间，机器人**原地更新**一条「进度」消息（飞书卡片 / 钉钉 AI Card）；完成后落最终回复。
6. 运维态指令：`/workers` 列出可用 worker、`/use code-reviewer` 切换本会话目标、`/new` 重置会话、`/status` 看 worker 状态、`/stop` 终止。
7. 同一会话在 web IDE 的 Channel 里可见、可接管——因为底座是同一个 Channel。

---

## 4. 架构设计

### 4.1 分层

```
┌─ Transport ──────────────────────────────────────────┐
│  WebhookTransport (现状)   StreamTransport (新增)     │
│                            钉钉 Stream / 飞书 WS      │
└───────────────────────┬──────────────────────────────┘
                        ▼  InboundEvent (归一化, v2)
┌─ Ingress Pipeline (新增, imbridge/ingress/) ─────────┐
│ 1. Dedupe      external_message_id 幂等              │
│ 2. Identity    external_user_id → user_id (配对)      │
│ 3. Policy      dmPolicy / groupPolicy / requireMention│
│ 4. Command     /workers /use /new /status /stop       │
│ 5. Route       route binding → target worker          │
│ 6. Compose     文本 → 结构化 MessageContent (含 mention)│
└───────────────────────┬──────────────────────────────┘
                        ▼
        channel.Service.SendMessageAsUser(真实 user_id)
                        ▼  PostSendHooks
        PodPromptHook ──→ PodRouter.RoutePrompt ──→ Runner/Pod
                        ▼
        worker 回复 (MCP send_channel_message)
                        ▼
┌─ Egress Pipeline (改造, imbridge/egress/) ───────────┐
│  精确定位连接 → 分片 → 平台渲染 → 去重 → 退避重试     │
│  progress draft: UpdateOutbound 原地改消息            │
└──────────────────────────────────────────────────────┘
```

### 4.2 核心决策与取舍

**决策 1：会话载体复用 Channel，不新建 IM Session 模型**

理由：Channel 已承载 worker 成员（`channel_pods`）、历史、@路由、权限、审计，且 web IDE 可见。新建第二套会话会让 worker 记忆分叉，也违背 SSOT。
代价：Channel 是 org 级实体，IM 私聊会产生大量 private channel。用 `visibility=private` + 列表默认折叠 IM 来源频道解决。

**决策 2：worker 路由三层，绑定优先于 @提及**

| 层 | 场景 | 载体 |
|---|---|---|
| 路由绑定 | 一个群/DM 固定对应一个 worker，用户不用 @ | `im_route_bindings` 表 |
| @提及 | 群里多 worker 共存 | inbound 文本解析 `@slug` → 结构化 mention |
| 会话内切换 | 临时改目标 | `/use <slug>` 指令，写 thread mapping |

优先级：会话内切换 > @提及 > 路由绑定 > 连接默认。这对齐 OpenClaw 的 `routing.bindings` + mention gating 组合。

**决策 3：身份绑定走配对码，不做 OAuth**

飞书/钉钉/企微都能做 OAuth 拿 unionid，但要求用户跳浏览器、且个人微信没有。配对码（OpenClaw pairing flow）对所有平台同构，实现成本最低。
落表 `im_identity_bindings`，未绑定用户按 `dm_policy` 处理：`pairing`（默认，回配对码）/ `reject` / `guest`（只读，仅允许查询类指令）。

**决策 4：Provider 接口加 capability 声明，不做能力假设**

各平台差异太大（企微不能编辑消息、钉钉有 AI Card、飞书有卡片 patch）。仿 OpenClaw Channel Broker 的 capability matrix，让 Provider 显式声明，共享层按能力降级：能编辑就 progress draft，不能就分段推送。

**决策 5：凭据加密对齐 `airesource`**

复用 `backend/pkg/crypto` 的 `Encryptor`。migration 加 `config_encrypted`，读时双路兼容（明文列存在则读明文并在下次写入时迁移），一个版本后删明文列。

### 4.3 数据模型

migration `000234_im_worker_connect.up.sql`（当前最新是 `000233`）：

```sql
-- 身份绑定：IM 用户 → 平台用户
CREATE TABLE im_identity_bindings (
    id               BIGSERIAL PRIMARY KEY,
    connection_id    BIGINT NOT NULL REFERENCES im_channel_connections(id) ON DELETE CASCADE,
    external_user_id VARCHAR(255) NOT NULL,
    external_name    VARCHAR(255),
    user_id          BIGINT REFERENCES users(id) ON DELETE CASCADE,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|bound|blocked
    pairing_code     VARCHAR(16),
    pairing_expires_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (connection_id, external_user_id)
);
CREATE UNIQUE INDEX ON im_identity_bindings (pairing_code) WHERE status = 'pending';

-- worker 路由绑定
CREATE TABLE im_route_bindings (
    id            BIGSERIAL PRIMARY KEY,
    connection_id BIGINT NOT NULL REFERENCES im_channel_connections(id) ON DELETE CASCADE,
    peer_kind     VARCHAR(16) NOT NULL,          -- direct|group|any
    peer_id       VARCHAR(512),                  -- NULL = 该 kind 的兜底
    target_kind   VARCHAR(16) NOT NULL,          -- expert|pod|channel
    target_ref    VARCHAR(255) NOT NULL,         -- expert_slug | pod_key | channel_id
    require_mention BOOLEAN NOT NULL DEFAULT FALSE,
    priority      INT NOT NULL DEFAULT 100,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON im_route_bindings (connection_id, peer_kind, priority);

-- inbound 幂等
CREATE TABLE im_inbound_dedupe (
    connection_id       BIGINT NOT NULL,
    external_message_id VARCHAR(255) NOT NULL,
    seen_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (connection_id, external_message_id)
);
CREATE INDEX ON im_inbound_dedupe (seen_at);   -- 定时清理 > 24h

-- 连接表扩展
ALTER TABLE im_channel_connections
    ADD COLUMN config_encrypted TEXT,
    ADD COLUMN transport      VARCHAR(16) NOT NULL DEFAULT 'webhook',  -- webhook|stream
    ADD COLUMN dm_policy      VARCHAR(16) NOT NULL DEFAULT 'pairing',
    ADD COLUMN group_policy   VARCHAR(16) NOT NULL DEFAULT 'allowlist',
    ADD COLUMN allow_from     JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN streaming_mode VARCHAR(16) NOT NULL DEFAULT 'progress', -- off|block|progress
    ADD COLUMN last_seen_at   TIMESTAMPTZ;

-- thread mapping 扩展：记录会话内 worker 选择 + 进度消息句柄
ALTER TABLE im_thread_mappings
    ADD COLUMN peer_kind         VARCHAR(16) NOT NULL DEFAULT 'group',
    ADD COLUMN active_target_ref VARCHAR(255),
    ADD COLUMN draft_message_id  VARCHAR(255);
```

### 4.4 Provider 接口演进

`InboundEvent` 缺的字段是所有下游能力的前提：

```go
type InboundEvent struct {
	ExternalMessageID string      // 幂等去重
	ExternalThreadID  string
	ExternalUserID    string      // 身份绑定（当前只有 SenderName）
	SenderName        string
	PeerKind          PeerKind    // direct | group
	Text              string
	MentionedBot      bool        // requireMention 判定
	Mentions          []string    // 文本中被 @ 的名字
	Attachments       []Attachment
	Challenge         string
	ContextToken      string
}
```

`Provider` 增补：

```go
type Provider interface {
	Type() string
	DisplayName() string
	Capabilities() Capabilities
	ValidateConfig(raw json.RawMessage) error
	VerifyWebhook(ctx, cfg, headers, body) error
	ParseInbound(ctx, cfg, headers, body) (*InboundEvent, error)
	SendOutbound(ctx, cfg, OutboundMessage) (*DeliveryHandle, error)
}

type MessageEditor interface {  // 可选，飞书/钉钉实现
	UpdateOutbound(ctx, cfg, handle DeliveryHandle, msg OutboundMessage) error
}
type StreamTransport interface { // 可选，钉钉 Stream / 飞书 WS 实现
	Run(ctx context.Context, cfg json.RawMessage, sink func(*InboundEvent) error) error
}

type Capabilities struct {
	TextLimit    int
	CanEdit      bool
	CanCard      bool
	CanStream    bool
	MediaMaxMB   int
	HasStreamTransport bool
}
```

### 4.5 长连接传输的部署约束

`StreamTransport` 需要常驻 goroutine。backend 多副本下必须选主，否则每个副本各连一次 → 消息重复。方案：复用现有 Redis，`SETNX im:stream:lock:<connection_id>` + TTL 续租，失主副本退出连接。断线用指数退避重连（对齐 OpenClaw 做法）。健康态写 `last_seen_at`，前端「连接」板块直接展示。

---

## 5. 实施计划

每个阶段独立可交付、可回滚。文件全部遵守 200 行硬上限，超出即按 SRP 拆分。

### 进度（2026-07-26）

**P0 进行中 / 本轮已落地：**
- [x] 拆分 `providers.go` → `provider_{feishu,dingtalk,wecom,slack}.go` + crypto 辅助
- [x] 飞书：`header.token` 校验 + `encrypt` AES-CBC 解密 + webhook SHA256 签名
- [x] 钉钉：签名改为 Base64（对齐 OpenClaw fixture）
- [x] 企微：XML Encrypt + msg_signature + EncodingAESKey 解密；GET URL 验证
- [x] 微信：`ilink/bot/` 路径、`base_info.bot_agent`、单飞 long-poll、thread=`from_user_id`
- [x] inbound 幂等（进程内 TTL dedupe）+ `@slug` → 结构化 pod mention（可触发 PodPromptHook）
- [ ] 凭据 AES 加密落库（下一轮）
- [ ] 出站精确定位 / 多副本 Redis dedupe（下一轮）

### P0 — 修复与加固（阻断项，1 周）

| 动作 | 文件 |
|---|---|
| 飞书 `header.token` 校验 + `encrypt` AES 解密 | 拆出 `imbridge/provider_feishu.go`、`provider_feishu_crypto.go` |
| 钉钉签名改 base64 | `imbridge/provider_dingtalk.go` |
| 企微 XML/AES 解密 + `msg_signature` 校验 | `imbridge/provider_wecom.go`、`provider_wecom_crypto.go` |
| Slack 拆出 | `imbridge/provider_slack.go` |
| config AES-GCM 加密（双读兼容） | `imbridge/config_cipher.go` |
| inbound 幂等 | `imbridge/ingress/dedupe.go` |
| 出站精确定位，去掉全连接扇出 | `imbridge/egress/resolver.go` |
| migration | `000234_im_worker_connect.{up,down}.sql` |

现有 483 行的 `providers.go` 必须在这一阶段解体——它已经违反 200 行上限，且是 4 个 bug 的共同栖息地。
验收：三平台各跑一次真实回调，签名校验开启后能通过；重复推送不产生重复消息；`config` 落库为密文。

### P1 — 身份绑定（1 周）

- `imbridge/ingress/identity.go`：`Resolve(connID, externalUserID) → user_id | pending`
- `imbridge/pairing.go`：生成/校验 6 位配对码，TTL 10 分钟
- `imbridge/ingress/policy.go`：`dmPolicy` / `groupPolicy` / `allowFrom` 匹配（含 `*`、userID、`user:name` 三种模式）
- REST：`POST /api/v1/orgs/:slug/im-channels/:id/pair`（管理员批准）、`POST /api/v1/me/im-pair`（用户自助输码）
- `DeliverInbound` 改为用真实 `user_id`；未绑定按策略回配对码或拒绝

验收：陌生人私聊拿到配对码而非直接进入组织；绑定后消息归属正确用户；`allowFrom` 生效。

### P2 — Worker 路由（核心，1.5 周）

- `imbridge/ingress/router.go`：绑定 → @提及 → 会话切换 三层优先级解析
- `imbridge/ingress/compose.go`：文本 `@slug` → 结构化 `InlineMention{EntityType: EntityPod}`，让 `PodPromptHook` 真正触发
- `imbridge/ingress/command.go`：`/workers` `/use` `/new` `/status` `/stop` `/help`
- `imbridge/route_binding.go` + repo：路由绑定 CRUD
- 目标为 `expert` 时按需拉起 pod（复用 `expert.Service.Run`），并把 pod 加入对应 channel

验收：群里 `@code-reviewer 看下 PR` 让对应 worker 收到提示词并回复；绑定了 worker 的群不 @ 也能对话；`/use` 能切换目标；`/workers` 列出组织内可用 worker。

### P3 — 回流与体验（1 周）

- `imbridge/egress/chunk.go`：按 `Capabilities.TextLimit` 分片，不切断代码块
- `imbridge/egress/render.go`：markdown / 飞书卡片 / 钉钉 AI Card 渲染
- `imbridge/egress/progress.go`：progress draft，有 `CanEdit` 就原地更新，否则降级分段
- `imbridge/egress/retry.go`：指数退避 + jitter + outbound 去重
- 订阅 `pod:agent_status_changed` 驱动进度回显

验收：长任务期间 IM 侧有进度反馈；超长回复不被平台截断；网络抖动不产生重复消息。

### P4 — 长连接传输（1 周）

- `imbridge/transport/stream.go`：Redis 选主 + 生命周期管理
- `imbridge/transport/dingtalk_stream.go`、`feishu_ws.go`
- 连接健康探测 + `last_seen_at`

验收：无公网环境下钉钉/飞书可用；backend 多副本时消息不重复；kill 主副本后 30s 内接管。

### P5 — 前端「连接」板块（1 周）

从设置页 tab 提升为一级路由 `clients/web/src/app/(dashboard)/[org]/connections/`：

| 组件 | 职责 |
|---|---|
| `ProviderGallery.tsx` | 平台卡片 + 接入难度/能力标注 |
| `ConnectionWizard.tsx` | 分步：凭据 → 传输模式 → 策略 → 验证 |
| `ConnectionHealthCard.tsx` | 状态 / `last_seen_at` / `last_error` |
| `RouteBindingEditor.tsx` | 群/DM → worker 绑定表格 |
| `IdentityBindingList.tsx` | 待配对与已绑定成员 |
| `hooks/useConnections.ts` | 数据层 |

个人侧：`/settings` 增「我的 IM 绑定」入口（输配对码 / 解绑）。
现有 `IMChannelsSettings.tsx` 保留为跳转入口，避免破坏既有链接。i18n 同步 `messages/{zh,en}/`。

---

## 6. 风险

| 风险 | 处置 |
|---|---|
| 个人微信封号 | UI 明确标注非官方 + 风险提示，企业场景优先推飞书/钉钉 |
| IM 私聊产生大量 private channel | 列表折叠 IM 来源频道，加归档策略 |
| worker 输出泄漏到外部群 | egress 前校验目标 channel 与连接绑定关系；敏感 worker 可标记禁止外发 |
| 平台限流 | per-connection 令牌桶 + 退避 |
| 明文凭据历史数据 | P0 双读兼容，一个版本后加清理 migration |
| 跨 org 串台 | egress resolver 强制 `channel.OrganizationID == conn.OrganizationID` |

---

## 7. 与 OpenClaw 的取舍差异

| 维度 | OpenClaw | 我们 | 原因 |
|---|---|---|---|
| 部署形态 | 单机 Gateway，本地配置文件 | 多租户 SaaS，DB 配置 | 需要 org 隔离与加密 |
| 会话模型 | 独立 session store | 复用 Channel | Channel 已是团队协作 SSOT |
| Agent 路由 | `agentId` 指向本地 workspace | `expert_slug` / `pod_key` 指向 runner 上的 pod | worker 是远程隔离进程 |
| 配置入口 | CLI 向导 | Web 向导 | 用户是团队管理员，非开发者 |
| 插件分发 | npm plugin | 编译期 provider 注册 | Go 单体，YAGNI |
