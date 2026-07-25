# Worker 前端改造：前后端改动清单

状态：改动清单
日期：2026-07-25
设计：`2026-07-25-agent-ui-worker-frontend-design.md`
规则底座：`2026-07-25-worker-conversation-logic-map.md`

---

## 0. 三个先决发现

摸后端摸出三件事，其中第一件推翻了设计里 P2 的前提。

### 0.1 `host_online` 是假信号，八分支真值表有一半是死代码

后端从来没有独立的 host 存活：

- `session_list_wire.go:65-76` —— 列表与快照里 `host_online` **直接等于** `runner_online`
- `session_health.go:46` —— `/health` 的 `host_online` **恒为 `null`**
- `host_resumable` —— **后端根本不发这个字段**

而 `RunnerHealthProvider` 对当前打开的会话用 `/health` 轮询**覆盖**流里的值
（`RunnerHealthProvider.tsx:126-143`）。把这两件事合起来推一遍
`useSessionLiveness.ts:216-283`：

| runner | host（来自 /health） | 命中行 | 结果 |
|---|---|---|---|
| `true` | — | 1 | `online` |
| `false` | `null`，且 `hostId` 有值 | 6 | `unknown` |
| `false` | `null`，且无 `hostId` | 7 | `local_stranded` |

**行 3 / 3' / 3"（`host_offline`、`host_asleep`）永远不可达**——它们要求
`hostOnline === false`，而 `/health` 给的是 `null`。行 5（`runner_asleep`）同理不可达。

也就是说：当前打开的会话只可能是 `online` / `unknown` / `local_stranded` 三态。
`host_asleep` 的"发送即唤醒"、`host_offline` 的 owner CLI 提示、
`runner_asleep`——**线上都不会出现**。侧栏行（用流里的值，`host_online = runner_online`）
走的是另一条路径，行为又不一样。

所以 P2 不是"把真值表搬过去"，而是**先决定这个能力要不要真做**。

### 0.2 会话列表没有分页

`session_list_wire.go:82-90` 恒返回 `has_more: false`；`service_query.go:38` 排序写死
`updated_at DESC`；`sort` / `order` / `cursor` 参数**后端不读**
（`session_query.go:19-28`），`limit` 上限 100。

web-user 传 `limit=20` 做无限滚动——实际拿到一页就到底了。
P5 的分页规则要么补后端，要么承认列表就是单页。

### 0.3 pod 侧没有目录列举，`@` 提及在 pod 会话上做不了

pod 的工作区只有两个操作（`pod_workspace_artifacts.go:44-74`）：
`changes`（变更文件清单）和 `read`（读单文件）。**没有 list 目录**。
session 侧有完整的 `/filesystem[/{path}]` 列举（`session_filesystem.go:38-56`）。

P3 要在两个传输上都支持 `@`，pod 侧必须补一个 list op。

---

## 1. P1 — 契约 + pod 投影 + `WorkerConversation`

### 前端

| 文件 | 改动 |
|---|---|
| `packages/agent-ui/src/worker/contracts.ts` | 新增。`WorkerAuth` / `WorkerRef` / `WorkerRecovery` / `WorkerTransport` |
| `worker/liveness/workerLiveness.ts` | 新增。五态 + `WorkerReadOnlyReason` + `WorkerUnreachable` |
| `worker/liveness/podLivenessProjection.ts` | 新增。`projectPodLiveness`，输入 `podStatus` / `isPodReady` / `initProgress` / `podError` / `controlGranted` |
| `worker/WorkerClient.ts` | 新增。传输注册表 + `sessionId` 解析缓存 + 运行时缓存 |
| `worker/react/WorkerProvider.tsx` | 新增。持有 `WorkerClient` |
| `worker/react/WorkerConversation.tsx` | 新增。判活门 + 挂 `AgentWorkspace` |
| `worker/react/WorkerLivenessView.tsx` | 新增。`starting` / `unreachable` 两态视图，吸收宿主的四个状态视图 |
| `packages/agent-ui/src/AgentWorkspace.tsx` | 加 `wakeHint?: boolean` prop，其余不动 |
| `packages/agent-ui/package.json` | 加 `"./worker": "./src/worker/index.ts"` 导出 |

pod 状态取值以 `agentpod/pod.go:14-24` 为准（9 个值），投影表：

```
error / podError            → unreachable{launch-failed}
orphaned                    → unreachable{orphaned}, recovery:[wait]
terminated                  → unreachable{orphaned}
completed                   → online{readOnly:"ended"}
running && isPodReady       → online{readOnly: controlGranted ? null : "permission"}
queued/initializing/paused/disconnected/running-not-ready → starting{progress:initProgress}
```

`clients/web` 侧新增 pod 传输实现（**不进 agent-ui**，因为要走 wasm）：

| 文件 | 改动 |
|---|---|
| `clients/web/src/components/workspace/agent-ui/podWorkerTransport.ts` | 新增。实现 `WorkerTransport`：`resolveSession` 包 `fetchSessionByPodKey` 的 10×500ms 重试；`runtimeFor` 复用 `WebAgentWorkbenchRuntime`；`subscribeLiveness` 接 `usePod` 推送 + `projectPodLiveness` |
| `clients/web/src/components/workspace/AgentPanel.tsx` | 删 `67-89` 判活门（`usePodStatus` / `useAgentSessionLink` / `useAgentPanelRuntime` 调用）与 `122-161` 四个状态分支；改挂 `<WorkerConversation>`。保留 Pane 头部、分屏、最大化、`WorkerControlOverlay` |
| `clients/web/src/hooks/useAgentSessionLink.ts` | 逻辑移入 `podWorkerTransport.resolveSession`，文件删除 |
| `clients/web/src/components/workspace/PaneStateViews.tsx` | 三个视图（Loading / Error / Reconnecting）删除，由 `WorkerLivenessView` 承接 |
| `clients/web/src/components/workspace/AgentSessionLinkState.tsx` | 删除 |

### 后端

**P1 不需要后端改动**，重试留在 `resolveSession` 里即可。

可选优化（不阻塞）：pod→session 关联现在是**懒建**——Connect 建 pod 不设
`SessionProvision`（`create_pod_request.go:64-76`），要等首个 ACP 事件才走
`session_stream_publisher.go:54-86` 创建。若改成建 pod 时即
`PrepareForPod`（`pod_orchestrator_create.go:168`），10 次重试可以删掉。
代价是给非 ACP pod 也建了会话行。

---

## 2. P2 — omnigent 判活与恢复

**已决：方案 A**，不补 host 存活，零后端改动。

砍掉的只有 `asleep`——`starting` 必须保留（pod 的 `queued`/`initializing`
和 omnigent 的 45 秒冷启动宽限都要它）。最终是**四态**：
`unknown` / `starting` / `online` / `unreachable`。

代价明确记录在案：**"发送即唤醒"这个能力线上从未生效，此处正式放弃。**
若日后要补，对应后端改动是 6/7/8 号三项，外加厘清 host 与 runner 是否同一实体
的两个面（现在 `runnerOnlineMap` 读的是 DB `Runner.Status`，
不是内存态 gRPC 隧道注册表 `runner/status.go:22-25`）。

### 2.1 前端

| 文件 | 改动 |
|---|---|
| `worker/liveness/omnigentLivenessProjection.ts` | 新增。五分支：在线 / 冷启动宽限 / 未轮询 / host-bound 不猜 / stranded。不读 `hostOnline` |
| `worker/liveness/omnigentHealthPoll.ts` | 新增。10s 成功 / 指数退避至 60s；空集合清陈旧条目 |
| `worker/liveness/useRunnerOnlineEdge.ts` | 新增。上升沿触发 `refreshSessionState` |
| `worker/recovery/reconnectCommand.ts` | 新增。搬 `cli-commands.ts:5-36`，删 `host_offline` 分支（该状态不可达） |
| `worker/recovery/workerRecoveryOptions.ts` | 新增。未绑定 fork 判定 + fork 兜底 |
| `worker/transport/omnigentTransport.ts` | 新增。`subscribeLiveness` 合流：WS 行 + `/health` 轮询覆盖当前会话 |

owner 门（`permission_level == null || >= 4`）随 `host_offline` 一并删除——
方案 A 下只剩 `stranded`，CLI 命令对任何能看到该会话的人都成立。

### 2.2 后端

**无。** 唯一相关的是 5 号（列表填 `workspace`），因为未绑定 fork 判定依赖它；
不补则改判定依据，只看 `fork.source_id` 标签。

---

## 3. P3 — `@` 文件提及

### 前端

| 文件 | 改动 |
|---|---|
| `conversation/mentions/mentionToken.ts` | 新增。`MENTION_RE = /(?:^\|\s)@([^\s@]*)$/`、`detectMentionAt`、`parseMentionToken`（搬 `composerMentions.ts:47-107`） |
| `conversation/mentions/mentionRanking.ts` | 新增。`rankMentionEntries`：子串过滤 → 目录优先 → `localeCompare` → 截 50 |
| `conversation/mentions/mentionSerialize.ts` | 新增。`mentionItemPath`（`path:start-end` / `path/` / `path`）、`mentionMarkerFor`（codex 用 `[Attached file:`，其余 `[Attached:`）、`buildMentionPreamble` |
| `conversation/mentions/nativeCodingAgent.ts` | 新增。搬 `nativeCodingAgentForHarness`，处理 `native-codex` / `codex-native` 反写归一 |
| `conversation/mentions/workspaceFileSource.ts` | 新增。`list(sessionId, dir)` / `exists(sessionId, path)` 接口 |
| `conversation/mentions/useMentionBrowser.ts` | 新增。键盘状态机：上下选择、Tab 补目录保持菜单、Enter 提交、Esc/空格/失焦关闭 |
| `packages/agent-ui/src/ConversationComposer.tsx` | 接入提及菜单与前导块拼接 |
| `worker/transport/omnigentTransport.ts` | 实现 `workspaceFiles`：`/v1/sessions/{id}/resources/environments/{env}/filesystem[/{path}]?limit=1000&order=asc` |
| `clients/web/.../podWorkerTransport.ts` | 实现 `workspaceFiles`：依赖 3.2 的新 op |

### 后端

| 文件 | 改动 |
|---|---|
| `backend/internal/api/rest/v1/pod_workspace_artifacts.go` | **新增目录列举**。现有只有 `changes` 与 `read`（`44-74`），补 `list` sandbox op，响应对齐 session 侧 `session_filesystem_wire.go` 的 `{object:"list", data:[{id,name,path,type,bytes,modified_at}], workspace_root}` |
| `backend/internal/api/rest/routes_pod_queue.go:41-42` | 注册 `GET .../pods/{podKey}/resources/workspace/filesystem`（无 path = 根目录列举） |

对齐两侧响应形状是必要的，否则 `WorkspaceFileSource` 要写两套解析。

---

## 4. P4 — 历史滚动锚定

### 前端

| 文件 | 改动 |
|---|---|
| `conversation/history/useHistoryAnchor.ts` | 新增。加载旧页前记 `scrollHeight`，插入后按差值补 `scrollTop`，保证视觉不跳 |
| `conversation/history/useLoadOlderTrigger.ts` | 新增。顶部阈值触发 + 在途去重 + `hasOlderItems` 到底停 |
| `conversation/history/JumpToLatest.tsx` | 新增。出现条件：距底超过一屏且有新内容 |
| `packages/agent-ui/src/ActivityTimeline.tsx` | 接锚定与触发；切换会话时滚动位置重置 |

F1 的取数（`fetchOmnigentInitialHistory` / `loadOlder`）已就绪，这期只做滚动侧。

### 后端

**无改动。** `GET /v1/sessions/{id}/items` 的 `limit` / `after` / `order` 都已实现，
`has_more` 是真实值（`session_items.go:16-36`）——与列表接口不同。

---

## 5. P5 — 会话目录

### 前端

| 文件 | 改动 |
|---|---|
| `worker/directory/workerDirectoryEntry.ts` | 新增。目录行模型 |
| `worker/directory/directorySocket.ts` | 新增。WS 四帧、250ms×2 封顶 5s ±50% 抖动重连、70s 静默看门狗、`watch` 集合序无关比较 |
| `worker/directory/directoryMerge.ts` | 新增。字段级增量覆盖 + `needsResort`（`archived` / `title` / 非活跃行 `updatedAt`） |
| `worker/directory/activeEntryOverride.ts` | 新增。活跃会话位置冻结 |
| `worker/directory/directoryUnseen.ts` | 新增。未读三条件 + hydration 闸门 + 显式标未读基线 |
| `worker/directory/useWorkerDirectory.ts` | 新增。watch 集 = 缓存会话 ∪ 活跃会话；连流 60s / 断流 45s 对账 |
| `clients/web-user/src/hooks/useConversations.ts` | 收缩：保留项目 CRUD 与置顶回填，列表取数与合并改走 `useWorkerDirectory` |
| `clients/web-user/src/lib/sessionListCache.ts` | 删除，逻辑进 `directoryMerge.ts` |
| `clients/web-user/src/lib/sessionUpdatesSocket.ts` | 删除，逻辑进 `directorySocket.ts` |
| `clients/web-user/src/hooks/useUnseenConversations.ts` | 收缩：保留 localStorage 持久化，判定改走 `directoryUnseen.ts` |
| `clients/web-user/src/shell/Sidebar.tsx` | 改消费 `WorkerDirectoryEntry[]`；五分区、置顶顺序、拖拽归档、worker×project 分组**保留在宿主** |

### 后端

| 文件 | 改动 | 为什么 |
|---|---|---|
| `session_updates_hub.go:105-112, 134-137` | 推送行补 `enrichOwnership` | 现在 WS 行不带 `permission_level` / `owner` / `viewer_last_seen` / `viewer_unread`，字段级合并会把这些覆盖没 |
| `session_updates_hub.go` + `session_delete.go:54-55` | 新增 `removed` 帧 | 前端已按四帧型处理，后端只发三种；删除走 `NotifyChanged`，前端要靠 refetch 才发现 |
| `session_query.go:19-28` + `service_query.go:38` | 支持 `cursor` / `sort` / `order`，`has_more` 返回真实值 | 见 0.2，现在恒 `false`，无限滚动是假的 |
| `session_list_wire.go:42-48` | 填 `workspace` 字段 | 已声明未填（`:22`），未绑定 fork 判定依赖它 |

以下两项**建议删前端而不是补后端**：

| 前端能力 | 后端现状 | 建议 |
|---|---|---|
| POST events 的 `denied` 结算路径 | 未实现；预算超限走 `402 cost_budget_exceeded`（`cost_budget_gate.go:26-31`） | 删掉 `denied` 分支，改按 402 处理 |
| SSE `?idle=` presence 上行 | `session_stream.go` 不读该参数，无 viewer 追踪 | 删掉 `presenceIdleTracker` 与配套的 per-attempt AbortController 回收 |

---

## 6. 后端改动汇总

按是否阻塞排序。

四项在本方案范围内，其余搁置。

| # | 改动 | 阻塞 | 文件 |
|---|---|---|---|
| 1 | pod 工作区目录列举 op | P3 | `pod_workspace_artifacts.go:44-74`、`routes_pod_queue.go:41-42` |
| 2 | WS 推送行补 `enrichOwnership` | P5 | `session_updates_hub.go:105-112, 134-137` |
| 3 | WS `removed` 帧 | P5 | `session_updates_hub.go`、`session_delete.go:54-55` |
| 4 | 列表 keyset 分页（cursor + 真实 `has_more`） | P5 | `session_query.go:19-28`、`service_query.go:17-38`、`session_list_wire.go:82-90` |
| 5 | 列表填 `workspace` | P2/P5 | `session_list_wire.go:42-48` |
| — | 以下搁置 | | |
| 6 | `host_online` 真实化 | 已放弃（方案 A） | `session_list_wire.go:65-76`、`session_health.go:46` |
| 7 | `/health` 去 owner-only 过滤 | 已放弃（方案 A） | `session_health.go:30-33` |
| 8 | 快照发 `host_resumable` | 已放弃（方案 A） | `session_wire.go` |
| 9 | pod 会话即时 provisioning | 优化，不阻塞 | `create_pod_request.go:64-76`、`pod_orchestrator_create.go:168` |

### 4 号：keyset 分页的形状

```
GET /v1/sessions?limit=20&cursor=<base64(updated_at:id)>&project=&include_archived=
→ { data: [...], has_more: bool, next_cursor: string | null, first_id, last_id }
```

```sql
WHERE (updated_at, id) < (:cursor_updated_at, :cursor_id)
ORDER BY updated_at DESC, id DESC
LIMIT :limit + 1        -- 多取一条判 has_more
```

**必须 keyset 不能 offset**：`updated_at` 随消息不断变动，
offset 分页在翻页途中会漏行和重复行。排序键加 `id` 兜底同秒行，
前端 `sortEntries` 已按同一规则排（设计 §6.4）。

Connect 侧**不需要任何改动**——它缺的能力（会话列表、read-state、presence、
文件列举）在本方案里都不由 Connect 承担：pod 会话的目录不进 agent-ui，
文件列举走 REST pod 路由。

---

## 7. 已决

| 项 | 决定 |
|---|---|
| host 存活（0.1） | 方案 A。四态 `unknown`/`starting`/`online`/`unreachable`，"发送即唤醒"放弃 |
| 列表分页（0.2） | 做。keyset cursor，见 4 号 |
| pod 目录列举（0.3） | 做。1 号，P3 阻塞项 |
