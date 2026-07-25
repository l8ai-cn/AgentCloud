# 各渠道参考代码与实现逻辑分析

本地参考仓库（浅克隆）：

| 渠道 | 仓库 | 本地路径 |
|------|------|----------|
| 飞书 / Lark | [openclaw/openclaw `extensions/feishu`](https://github.com/openclaw/openclaw/tree/main/extensions/feishu) (`@openclaw/feishu`) | `/tmp/im-refs/openclaw-feishu/extensions/feishu` |
| 钉钉 | [soimy/openclaw-channel-dingtalk](https://github.com/soimy/openclaw-channel-dingtalk) (`@soimy/dingtalk`) | `/tmp/im-refs/dingtalk` |
| 个人微信 | [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin) (`@tencent-weixin/openclaw-weixin`) | `/tmp/im-refs/weixin` |
| 企业微信 | [WecomTeam/wecom-openclaw-plugin](https://github.com/WecomTeam/wecom-openclaw-plugin) (`@wecom/wecom-openclaw-plugin`) | `/tmp/im-refs/wecom` |

AgentsMesh 对照实现：`backend/internal/service/imbridge/`

---

## 总览：四渠道传输模型差异

```
飞书:     WebSocket 长连接（默认） 或  Webhook（SHA256 签名 + AES 解密）
钉钉:     Stream (DWClient WebSocket) —— 主路径无公网；HTTP 加签仅自定义机器人
个人微信: iLink 长轮询 getupdates —— 扫码登录，无私聊以外能力
企业微信: Bot WS / Bot Webhook(JSON) 或 Agent Webhook(XML+AES) —— 双模式可并存
```

共性流水线（OpenClaw Channel 契约）：

```
平台事件 → Provider 归一化 → 去重 → ACL/pairing → session peer → Agent → 出站(分片/流式/卡片)
```

AgentsMesh 应抄**协议与安全契约**，不抄 OpenClaw plugin-sdk 全家桶与巨型单文件。

---

## 1. 飞书（@openclaw/feishu）

### 1.1 关键文件

| 职责 | 路径 |
|------|------|
| Channel 装配 / gateway.startAccount | `src/channel.ts` |
| Monitor 总入口 | `src/monitor.ts` / `monitor.account.ts` |
| WS / Webhook 传输 | `src/monitor.transport.ts` |
| 入站消息 handler | `src/monitor.message-handler.ts` → `src/bot.ts` |
| Mention / Policy | `src/mention.ts` / `src/policy.ts` |
| 出站 / 流式卡片 | `src/send.ts` / `src/streaming-card.ts` / `src/reply-dispatcher.ts` |
| 会话 ID | `src/conversation-id.ts` / `src/session-route.ts` |
| AES 解密（durable） | `src/feishu-ingress.ts` |

### 1.2 入站逻辑（逐步）

```
gateway.startAccount
  → monitorFeishuProvider
    → createEventDispatcher(account)   // 注入 encryptKey + verificationToken
    → registerEventHandlers            // im.message.receive_v1 等
    → monitorWebSocket | monitorWebhook
```

**WebSocket（默认）**

1. `Lark.WSClient({ appId, appSecret, domain })` 建连
2. SDK 内建 autoReconnect；终端错误时外层指数退避 recreate（1s→30s）
3. 事件集合由飞书后台「事件订阅」+ `EventDispatcher.register` 决定，代码不声明 filter

**Webhook**

1. 强制 `encryptKey`（无则无法启动）
2. 签名（先于 JSON parse）：
   ```
   SHA256(timestamp + nonce + encryptKey + rawBody) == x-lark-signature
   ```
3. Challenge：`Lark.generateChallenge(payload, { encryptKey })`
4. 业务：`eventDispatcher.invoke(..., { needCheck: false })` —— HTTP 层已用 encryptKey 验签，不再二次验 token

**消息处理主路径 `handleFeishuMessage`**

| 步骤 | 作用 |
|------|------|
| parse + 丢弃 bot 自消息 | `sender.open_id === botOpenId` |
| dedupe | `message_id` + 文本 logical retry key |
| debounce | 同 chat+thread+sender 的 text 合并 |
| sequential queue | key=`feishu:{account}:{chatId}` |
| mention 校验 | open_id 跨 app 不可信时 API 回读 |
| group/DM policy | allowlist / pairing / requireMention |
| route → agent | sessionKey by group/topic/sender scope |

### 1.3 出站逻辑

- 文本默认 `msg_type: "post"`（markdown 表格转 post）
- 有 `replyToMessageId` → `im.message.reply`；失败码 `230011`/`231003` 回退 `im.message.create`
- 线程：`reply_in_thread: true`；失败且不允许 top-level 则硬失败（防串楼）
- 流式：CardKit create → PUT elements/content（sequence++）→ close 关 streaming_mode
- tenant token：`POST /auth/v3/tenant_access_token/internal`，缓存带 60s skew

### 1.4 会话 key 形态

| scope | conversation id |
|-------|-----------------|
| group | `{chatId}` |
| group_sender | `{chatId}:sender:{openId}` |
| group_topic | `{chatId}:topic:{topicId}` |
| group_topic_sender | `{chatId}:topic:{topicId}:sender:{openId}` |

### 1.5 对 AgentsMesh 的含义

| AgentsMesh 现状 | 参考做法 |
|-----------------|----------|
| 只读顶层 `token` | v2 在 `header.token`；webhook 主靠 encryptKey SHA256 |
| 不解密 `encrypt` | `AESCipher(encryptKey).decrypt(envelope.encrypt)` |
| 仅 webhook | 默认应支持 WS 长连接 |
| 无幂等 | `event_id` + message_id + text-retry key |
| 无 requireMention | 群默认 requireMention（open 策略除外） |

**Gotcha**：`private` 不算 group（走 DM 策略）；同秒同文可能被 logical dedupe 丢掉；webhook 多账号默认同 port 3000 会冲突。

---

## 2. 钉钉（@soimy/dingtalk）

### 2.1 关键文件

| 职责 | 路径 |
|------|------|
| Channel / gateway | `src/channel.ts` / `src/gateway/channel-gateway.ts` |
| Stream 连接管理 | `src/connection-manager.ts` |
| Token | `src/auth.ts` |
| 自定义机器人签名（非 Stream 主路径） | `src/signature.ts` |
| 入站 | `src/inbound-handler.ts` |
| ACL / 去重 | `src/access-control.ts` / `src/dedup.ts` |
| 出站 / AI Card | `src/send-service.ts` / `src/card-service.ts` / `src/draft-stream-loop.ts` |
| Session / 多 Agent | `src/session-routing.ts` / `src/targeting/agent-routing.ts` |
| /stop | `src/command/card-stop-command.ts` |

### 2.2 Stream 模式端到端

```
配置 clientId + clientSecret
  → POST /v1.0/oauth2/accessToken  (出站用，缓存提前 60s 刷新)
  → new DWClient({ clientId, clientSecret })  // dingtalk-stream
  → getEndpoint() → WebSocket
  → TOPIC_ROBOT 回调 → 立刻 ACK → handleDingTalkMessage
  → TOPIC_CARD 回调 → 卡片交互（停止/点赞/表单）
```

**ConnectionManager**（关掉 SDK 自带 autoReconnect）：

- 指数退避 + jitter
- Warm reconnect：新旧 socket 并行，缩短丢消息窗口
- 20s ping；连续 miss 2 次重连
- 解析 `type=SYSTEM && topic=disconnect` 立即重连

**安全边界**：Stream **不验 HMAC**；持有 `clientSecret` 才能建连。`signature.ts` 是自定义机器人算法：

```
HMAC-SHA256(key=secret, msg=timestamp+"\n"+secret) → Base64
```

AgentsMesh 当前用 hex，且把 Stream 与 Webhook 签名混为一谈 —— 需要拆清。

### 2.3 入站字段模型

| 字段 | 含义 |
|------|------|
| `conversationType === "1"` | 单聊；否则群 |
| `senderStaffId \|\| senderId` | 发送者（优先 staffId） |
| `conversationId` | 群多为 `cid...` |
| `sessionWebhook` | 短期回复 URL（优先于主动推送） |
| `msgId` | 去重键 |
| `atUsers` | @ 列表（多 Agent 名匹配） |

忽略自消息：`senderId/staffId === chatbotUserId`。  
@机器人是否必填：主要由钉钉后台「接收策略」决定；插件层 `requireMention` 交给 host。

### 2.4 去重（两层）

1. **inflight**：`${robotKey}:${msgId}`，TTL 5min，防并发双处理
2. **processed**：内存 TTL 60s，上限 1000

顺序：ACK 先于处理（防钉钉重试压垮）。多实例下内存 dedupe 不够，AgentsMesh 应用 Redis/DB。

### 2.5 出站：Markdown vs AI Card

**Markdown**：优先 `POST sessionWebhook`；~3800 字切块；不能原地编辑 → 用增量后缀消息「伪流式」。

**AI Card 生命周期（必抄）**：

```
1. POST /v1.0/card/instances/createAndDeliver
   - 群: openSpaceId = dtv1.card//IM_GROUP.${conversationId}
   - 单聊: dtv1.card//IM_ROBOT.${conversationId}
   - flowStatus=INPUTING(2), callbackType=STREAM

2. Kick（群卡关键）: PUT /v1.0/card/streaming
   key=content, content="", isFull=true, isFinalize=false
   → 不 kick 则后续 blockList 更新可能静默失败

3. 流式: PUT /v1.0/card/streaming
   key=content, isFull=true（全量覆盖，非 append）

4. 过程块: PUT /v1.0/card/instances
   cardParamMap.blockList = CardBlock[] JSON

5. Finalize: streaming isFinalize=true → instances 写最终
   blockList + content + copy_content + flowStatus=3
```

节流：`draft-stream-loop` single-flight + latest-wins，默认 interval 1000ms。  
`/stop` **绕过 session lock**，立刻 abort。

### 2.6 对 AgentsMesh 的含义

| 应抄 | 应避 |
|------|------|
| Stream + ConnectionManager | 86KB 单体 inbound-handler |
| 先 ACK 后处理 + 双层去重 | 仅内存 dedupe（多副本） |
| sessionWebhook 优先回复 | Markdown 伪流式刷屏 |
| AI Card kick → stream → finalize | 整包 OpenClaw session alias |
| staffId\|\|senderId 身份模型 | 把签名当 Stream 安全方案 |

---

## 3. 个人微信（@tencent-weixin/openclaw-weixin）

### 3.1 关键文件

| 职责 | 路径 |
|------|------|
| API / long-poll | `src/api/api.ts` / `src/api/types.ts` |
| QR 登录 | `src/auth/login-qr.ts` |
| Pairing | `src/auth/pairing.ts` |
| Monitor | `src/monitor/monitor.ts` |
| 入站 / context_token | `src/messaging/inbound.ts` / `process-message.ts` |
| 出站 | `src/messaging/send.ts` |
| CDN AES | `src/cdn/aes-ecb.ts` |
| sync 游标 | `src/storage/sync-buf.ts` |

### 3.2 登录流（QR）

```
POST ilink/bot/get_bot_qrcode?bot_type=3
  body: { local_token_list: [...] }     // 多账号去重
  → 终端展示 QR
GET  ilink/bot/get_qrcode_status?qrcode=...
  状态机: wait → scaned / scaned_but_redirect → need_verifycode → confirmed
  confirmed 凭证: bot_token, ilink_bot_id, baseurl, ilink_user_id
```

`scaned_but_redirect` 后必须改 poll base；最终 `baseurl` 才是业务 API。  
`need_verifycode`：手机显示数字配对（国内常见）。

### 3.3 传输：长轮询

```
POST {baseurl}/ilink/bot/getupdates
Headers:
  Authorization: Bearer <bot_token>
  AuthorizationType: ilink_bot_token
  iLink-App-Id: bot
  iLink-App-ClientVersion: ...
  X-WECHAT-UIN: <random>
Body:
  { get_updates_buf, base_info: { channel_version, bot_agent } }
```

- Client timeout 35s；超时当空响应续轮
- 游标持久化；**单账号单 while 循环**（禁止并发 long-poll）
- `errcode === -14`：token 过期，暂停该账号 1 小时
- 启停：`ilink/bot/msg/notifystart` / `notifystop`

### 3.4 入站 / 出站

**入站**：TEXT=1 / IMAGE=2 / VOICE=3 / FILE=4 / VIDEO=5；ChatType 硬编码 `"direct"`（**无群聊**）。  
媒体：CDN 下载 + **AES-128-ECB** 解密。

**出站核心约束**：

> `context_token` 由 getupdates 按消息下发，**每条出站必须原样回传**。

- 文本：`message_type=BOT`，`message_state=FINISH`
- 媒体：`getuploadurl` → AES-ECB 加密 PUT → `sendmessage`（每条 media 单独一条 request）
- 无真流式气泡；有 typing / tool progress

### 3.5 AgentsMesh 对照（已验证）

| 参考 | AgentsMesh (`weixin_ilink.go`) |
|------|--------------------------------|
| `ilink/bot/getupdates` | ❌ `getupdates`（缺前缀） |
| `ilink/bot/sendmessage` | ❌ `sendmessage` |
| `bot_agent` 在 body `base_info` | ❌ 放在 HTTP header |
| 单飞 long-poll | ❌ ticker 每 2s 可能重叠 |
| QR POST + local_token_list | ❌ GET，无 verify_code |
| context_token 回传 | ✅ 有（ThreadMapping） |
| pairing / CDN 媒体 | ❌ 无 |

**优先修复顺序**：路径前缀 → base_info → 单飞 poll → QR verify_code → thread 用 `from_user_id`。

---

## 4. 企业微信（@wecom/wecom-openclaw-plugin）

### 4.1 关键文件

| 职责 | 路径 |
|------|------|
| Channel / 双模式出站 | `src/channel.ts` |
| Bot WS | `src/monitor.ts` |
| Bot 消息解析 / 流式发送 | `src/message-parser.ts` / `src/message-sender.ts` |
| Agent XML webhook | `src/agent/webhook.ts` / `handler.ts` / `api-client.ts` |
| Bot webhook 加解密 | `src/webhook/handler.ts` |
| ACL | `src/dm-policy.ts` / `src/group-policy.ts` |

依赖：`@wecom/aibot-node-sdk`（`WSClient`、`WecomCrypto`）。

### 4.2 双模式

| | **Bot（智能机器人）** | **Agent（自建应用）** |
|--|----------------------|----------------------|
| 凭证 | `botId` + `secret` | `corpId` + `corpSecret` + `agentId` + `token` + `encodingAESKey` |
| 入站 | WS `wss://openws.work.weixin.qq.com` 或 JSON webhook | **仅** HTTP webhook（加密 XML） |
| 出站 | `replyStream` / `sendMessage` | `gettoken` + `message/send` / `appchat/send` |
| 流式 | ✅（6 分钟限制 errcode 846608） | ❌ |
| 群聊 | ✅ | ✅（回常常私信触发者防刷屏） |

可同账号双开；出站策略：**Bot WS 优先，失败回落 Agent HTTP**。

### 4.3 Agent 模式加解密（AgentsMesh 完全缺失）

```
EncodingAESKey(43 字符 Base64) → AES-256-CBC 密钥
msg_signature = SHA1(sort(token, timestamp, nonce, encrypt))

GET  ?echostr=...  → 验签 → decrypt(echostr) → 原样返回明文（URL 验证）
POST XML <Encrypt> → 验签 → decrypt → parseXml → 业务
响应: 立刻 HTTP 200 "success"，再异步主动发（被动加密回复不用）
```

**必须先起 Gateway 再在企微后台保存回调 URL**（保存瞬间立刻验 GET）。  
MsgId 内存去重 10 分钟（防重试）。

### 4.4 Bot 入站 msgtype

`text` / `voice` / `image` / `file` / `video` / `mixed` / `quote` / `event`  
群：`chattype === "group"` + `chatid`；发送者 `sys`/空丢弃。

### 4.5 AgentsMesh 对照

`WeComProvider` 仅有「用 corp 凭证发 text」骨架：

- `VerifyWebhook` → `return nil`（零校验）
- `ParseInbound` 期望 JSON，官方 Agent 回调是 **加密 XML**
- 配置收了 `encoding_aes_key` 但从未使用
- 无 Bot WS、无流式、无群策略、无 MsgId 去重、无 token 缓存

**结论**：企微要从零补 Agent 加解密链路，或直接对接 Bot WS；当前回调路径对官方不可用。

---

## 5. 跨渠道对照矩阵

| 维度 | 飞书 | 钉钉 | 个人微信 | 企业微信 |
|------|------|------|----------|----------|
| 推荐传输 | WS | Stream WS | 长轮询 | Bot WS 或 Agent webhook |
| 公网依赖 | WS 不需要 | 不需要 | 不需要 | Agent 需要；Bot WS 不需要 |
| 签名/加密 | encryptKey SHA256 + AES | Stream 无签；自定义机器人 Base64 HMAC | Bearer token | Agent: SHA1 + AES-256-CBC |
| 身份字段 | open_id | staffId\|\|senderId | ilink_user_id | FromUserName / userid |
| 群聊 | ✅ | ✅ | ❌ | ✅ |
| 流式回复 | CardKit | AI Card | 弱（typing） | Bot ✅ / Agent ❌ |
| 配对 | dmPolicy=pairing | 同 | 同 | 同 |
| AgentsMesh 可用度 | 半残（token/encrypt 错） | 半残（签名 hex 错；无 Stream） | 骨架可跑但路径/并发错 | 基本不可用 |

---

## 6. 实现优先级建议（按参考代码可信度）

1. **P0 按参考修协议缺陷**
   - 飞书：`header.token` + `encrypt` AES + webhook SHA256
   - 钉钉：签名改 Base64；区分 Stream vs 自定义机器人
   - 个人微信：`ilink/bot/` 前缀 + `base_info` + 单飞 poll
   - 企微：Agent XML/AES 或明确标注「仅主动出站」

2. **P1 抄共享层（四渠道同构）**
   - 去重 / ACL / pairing / requireMention / session peer
   - 文本 `@slug` → 结构化 mention（打通 worker）

3. **P2 抄平台特色出站**
   - 飞书 CardKit / 钉钉 AI Card（含群卡 kick）/ 企微 Bot replyStream
   - `/stop` 绕过会话锁

4. **P3 长连接传输**
   - 飞书 WS / 钉钉 Stream / 企微 Bot WS
   - 多副本 Redis 选主

---

## 7. 参考仓库本地位置

分析时浅克隆在 `/tmp/im-refs/`。需要复现：

```bash
# 飞书（sparse）
git clone --depth 1 --filter=blob:none --sparse https://github.com/openclaw/openclaw.git /tmp/im-refs/openclaw-feishu
cd /tmp/im-refs/openclaw-feishu && git sparse-checkout set extensions/feishu

# 钉钉 / 微信 / 企微
git clone --depth 1 https://github.com/soimy/openclaw-channel-dingtalk.git /tmp/im-refs/dingtalk
git clone --depth 1 https://github.com/Tencent/openclaw-weixin.git /tmp/im-refs/weixin
git clone --depth 1 https://github.com/WecomTeam/wecom-openclaw-plugin.git /tmp/im-refs/wecom
```
