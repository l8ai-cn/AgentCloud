# Worker 对话框能力 —— 逻辑地图

状态：分析，不含实现决策
日期：2026-07-25

前两版方案（`agent-ui-session-shell-consolidation-design.md` 套壳方案、
`agent-ui-worker-conversation-migration-plan.md` 搬运方案）都作废。本文只做一件事：
把 web-user 对话框里**到底有哪些逻辑**梳理清楚，为后续讨论"迁哪些"提供事实底座。

---

## 1. 口径纠正：25,700 错在哪

上一版给出的"25,700 行生产代码 + 16,000 行测试"是**按文件求和**得到的，
把三类根本不该迁的东西算进了迁移量：

| 类别 | 说明 | 占比（抽样四个域） |
|---|---|---|
| JSX / shadcn 标记 | 折叠面板、Alert、Dialog、Tailwind 类名 | ~26% |
| zustand / react-query 样板 | `set`/`get` 包装、queryKey、invalidate、字段声明 | ~15% |
| web-user 应用壳 | 侧栏分区、置顶 localStorage、拖拽归档、Electron 角标、路由跳转 | ~15% |

剩下 **~44% 才是规则**。而"规则"也不是按行迁的——它是一条条**可断言的行为契约**，
在 agent-ui 自己的模型上重新表达，与 web-user 的行数没有对应关系。

**迁移单元是规则，不是文件，也不是行。**

---

## 2. 范围纠正：你要的 4 件事 vs 我扩成的 16 件事

原始需求是四组能力：

1. `@` 文件提及
2. 建会话 / 切换 / 重连 / CLI
3. 历史加载 / 跳顶
4. 侧栏会话列表

上一版方案把它扩成了 F1–F16，顺手把工具卡片、审批流、ExitPlanMode、Codex Goal、
成本路由、native-terminal 分叉、SmartRouting 全塞了进去——**那些不是你要的**。

按原始四组能力重新算：

| 能力 | 规则数 | web-user 规则行 | agent-ui 现状 |
|---|---:|---:|---|
| `@` 文件提及 | 8 | ~225 | 无 |
| 建会话 / 切换 / 重连 / CLI | 18 | ~700 | 部分（F1 已覆盖建流/重连传输层） |
| 历史加载 / 跳顶 | 5 | ~150 | F1 已覆盖取数，缺滚动锚定 |
| 侧栏会话列表 | 16 | ~900 | 无 |
| **合计** | **47** | **~2,000** | |

这才是原始需求的真实体量：**47 条规则，约 2,000 行规则源**。

下面第 4 节给出完整的四域规则地图（含超出原始需求的部分），标注哪些属于原始范围。

---

## 3. 已完成的 F1 与它的真实性质

F1 实现了 6 个规则区（SSE 建流、重连退避、先流后快照、增量累积、
乐观消息 FIFO 对账、历史窗口与补齐），在 agent-ui 落了 1,781 行 / 21 文件。

对应的 web-user 规则源约 1,300 行。**F1 是 1.4 倍膨胀，不是压缩。**
原因有二：200 行文件上限把逻辑摊成 21 个文件；以及写了一个 147 行的 `OmnigentTestServer`。

这个数据点很重要——它说明**规则数才是成本的度量，规则行数不是**，
而且在 agent-ui 里重新实现一条规则并不天然比 web-user 便宜。省下的是那 56% 的
标记和样板，不是规则本身。

---

## 4. 规则地图

标注：`[原始]` = 属于最初四组需求；`[扩展]` = 我自行扩入；`[留守]` = 应留在 web-user。

### 4.1 Composer（`ChatPage.tsx:3087-4742` 等，~4,154 行 → ~1,580 规则行）

**`@` 文件提及** `[原始]` — 8 条
- 触发条件：`@` 前必须是行首或空白；光标在 token 尾部；空格取消
- 候选排序比较器：变更文件优先 → 目录优先 → 路径深度 → 字典序
- 芯片状态机：键盘上下选择、Tab 补全目录并保持菜单、Enter 提交
- 写入外发文本的序列化格式（相对路径 + 可选 `#Lstart-end`）
- 目录 vs 文件的不同补全行为
- 菜单关闭的全部路径（Esc / 空格 / 失焦 / 提交）
- 去重键 `path|isDir|start-end`
- 从文件查看器排队进来的附件的 drain 规则

**输入语义** `[扩展]` — 6 条
- Enter 发送 / Shift+Enter 换行 / IME 组字期间 Enter 不发送（`ime.ts`）
- 上下方向键调取历史提示词：仅在光标位于首/尾、无修饰键；游标语义；草稿保留
- 自增高：`min(scrollHeight, lineHeight * maxRows + padding)`，`maxRows=10`
- 粘贴含文件时阻止文本粘贴
- 附件类型/大小校验表（image 5MB / pdf 20MB / text 10MB / document 10MB）
- 每会话草稿 Map + sessionStorage，含 StrictMode 双挂载守卫

**斜杠命令** `[扩展]` — 4 条
- `isSlashCommandText` 判定与首 token 高亮正则
- 内建命令表与 `/model`、`/context`、`/help` 的参数处理
- native 会话走纯文本、in-process 会话走 `sendSlashCommand` 的分叉
- 裸 `/model` 触发 AgentPicker 的 nonce 机制

**留在 web-user** `[留守]` — 13 项：回复引用链、连通性占位文案、子代理托盘、
状态行（分支/主机/上下文环）、成本路由控件、Codex Plan/Goal、语音听写、
AgentPicker、终端优先布局内边距。

### 4.2 会话状态机（`chatStore.ts`，4,261 行 → ~1,775 规则行，45 条规则）

F1 已覆盖 6 条。剩余 39 条中：

**建会话 / 切换 / 绑定** `[原始]` — 12 条
- 发送目标在提交时钉死（`submitConversationId`），失败回滚只影响该会话
- 新会话：先 PATCH sticky effort → 绑定在线 runner → 建流 → 再 POST
- 死流重绑闸门：会话存在且 `abortController === null` 才重绑
- `sessionBindingPatch` 统一映射快照→绑定字段，避免 bind 与 agent_changed 漂移
- 切换会话时的 stash 规则：只暂存未结算的自己的气泡（`pend_*` 且 `posted !== true`）
- `historyGeneration` 作废在途分页与对账
- sticky effort/model 交接：仅 native 家族、需模型兼容、子代理排除
- 终端侧 `/model` 只改会话级覆盖，不写 localStorage 全局默认
- POST `denied` 的本地结算（无 SSE 参与）
- 冷加载 pending 合并：服务端 FIFO + 客户端未知项 + 基线感知去重
- 绑定后若 `status === failed` 补合成错误块
- 发送失败且回合从未开始时的临时错误块

**`session_status` 状态机** `[扩展]` — 6 条（含 3 条高危，见第 5 节）

**native-terminal 分叉** `[扩展]` — 8 条（live 预览、text_done 原地替换、
consumed 文件块合并、idle 不清 pending 等）

**Elicitation 对账** `[扩展]` — 5 条

**留在 web-user** `[留守]` — 12 条：react-query 缓存补丁、侧栏状态镜像、
终端缓存、`redirectToConversationId` 的路由消费、工作区失效防抖、初始提示词交接。

### 4.3 渲染器（`blocks/**` + 6 个 lib，~4,550 行 → ~2,450 决策行）

**全部 `[扩展]`**——原始需求里没有渲染器。agent-ui 已有等价物 6 项
（连续工具分组、通用工具卡、权限问答表单、审批坞、GFM markdown、工具组摘要）。

无 agent-ui 等价物的 20 项中，最实质的是：
- `renderItems.ts` 的气泡管线（工具↔结果配对、生命周期、cancelled、增量缓存）
- 工具运行分区的 `STREAMING_TAIL = 3` 与"进行中/常驻卡不折叠"豁免
- 工具五态模型（含 `cancelled` / `no-output`）
- `toolTitle.ts` 的按工具名格式化表（~30 个工具）
- 审批模式路由器（6 模式）与各自的提交载荷形状
- 病态 markdown 检测（>50,000 字符或最长连续非空白 >5,000）
- markdown 内联代码里的工作区路径可点击化（需变更文件或磁盘存在确认）
- 工具输出截断阈值（80 行 / 12,000 字符）

### 4.4 会话目录与存活（~4,831 行 → ~2,409 规则行）

**存活判定真值表** `[原始]` — 1 条大规则（8 分支）
输入：`runner_online`、`host_online`、`host_id`、`host_resumable`、`turnActive`、
`created_at`（45 秒宽限，仅当 runner 本次挂载从未在线）、`permission_level`。
输出：`online` / `starting` / `runner_asleep` / `host_asleep` / `host_offline` /
`local_stranded` / `unknown`。
消费语义三档：`unknown` 不拦截；`*_asleep` 输入框开放、发送即唤醒；
`host_offline` / `local_stranded` 输入框封锁 + 重连横幅。

**存活信号来源** `[原始]` — 3 条
- 侧栏行走 WS 流；当前会话额外**始终**跑 10 秒 `/health` 轮询覆盖流值
  （runner 隧道掉线是内存态，不写库，不会经 WS 推送）
- 轮询失败指数退避至 60 秒
- `runnerOnline` 上升沿触发 `refreshSessionState`

**会话列表** `[原始]` — 8 条
- 服务端 `sort_by=updated_at&order=desc&limit=20`；连流时 60 秒对账轮询，
  断流时 45 秒
- 当前打开的会话在列表中**位置冻结**（进入时快照 `updatedAt` 作为排序键）
- WS 帧四型（snapshot / changed / removed / heartbeat）；合并是**字段级增量覆盖**，
  不是整表替换
- 触发全量 refetch 的条件：watch 集里有 id 不在缓存页、`archived` 变化、
  `title` 变化、非活跃行的 `updated_at` 变化
- watch 集 = 缓存中所有会话 id ∪ 当前活跃会话 id（覆盖不在侧栏的子会话）
- 重连退避 250ms 起 ×2 封顶 5s ±50% 抖动；70 秒静默看门狗

**未读** `[原始]` — 4 条
- 未读 = `status ∈ {idle, failed}` ∧ `lastSeen[id]` 存在 ∧ `updated_at > lastSeen[id]`
- 无 lastSeen 条目视为**已读**（避免重启后洪泛）
- hydration 闸门：首次 seed 前禁用自动标记已读
- 显式"标为未读"把基线设为 `updated_at - 1`

**重连 / CLI** `[原始]` — 4 条
- 重连对话框仅在 `host_offline` / `local_stranded` 弹出，`*_asleep` 不弹
- CLI 命令构造：`host_offline` 不带 session id；`local_stranded` + claude-native 带
  `resume {id}`
- `host_offline` 时 CLI 页签仅对 owner（`permission_level >= 4`）可见
- 未绑定 fork（有 `fork.source_id` 标签且 workspace 为空）走 ResumeWithDirectory
  而非 Reconnect

**留在 web-user** `[留守]` — 侧栏五分区、置顶顺序与 localStorage、拖拽归档、
worker×project 视觉分组、Electron 角标、项目 CRUD、`SwitchAgentDialog`（入口已下线）。

---

## 5. 最容易静默丢失的规则

这些是重写时最可能漏掉、且漏掉后没有立即症状的：

1. native 会话 `session_status → idle` **不得**清 pending 气泡（consumed 可能晚到）
2. `backgroundTaskCount` 未定义时保持不变；stop-hook 的 `waiting`+count 后约 1 秒
   会跟一条裸 `idle`，覆盖会让"N 个后台任务"闪没
3. `idle` 且 `responseId` 未定义、而本地正在流式 → **空操作**（denied 队列场景）
4. 终端 `/model` 改会话覆盖但不改 localStorage 全局默认
5. 冷加载 pending 的基线感知去重（重发历史里已有的文本会让气泡消失到 commit）
6. 当前会话的 `/health` 轮询不能省——只靠 WS 会一直显示"在线"
7. 无 lastSeen 条目视为已读（否则重启后全部标红）
8. 会话列表中活跃行的位置冻结（否则用户打字时自己的会话在侧栏跳动）
9. `tool_result` **不**解决 elicitation
10. 45 秒 starting 宽限只在 runner 本次挂载从未在线时适用（否则崩溃被掩盖）

---

## 6. 尚未查清

- 附件上传的实际线协议（Composer 只把 `File[]` 交给 `onSend`，编码与端点在
  `chatStore.send` 之外的调用链里）
- `@` 菜单在根目录只取顶层（`limit=1000`），深层目录是否需要递归——
  存在 `useWorkspaceFileSearch` 但 Composer 未使用，意图不明
- 服务端剥离附件标记的规则定义在 Python executor，不在前端

---

## 7. 定位（已确认）与它推翻的东西

**agent-ui 不是共享组件库，它就是对接 worker 的前端。** 会话目录属于 agent-ui，
native 会话同样属于 agent-ui——问"这个职责归谁"本身就问错了，前端的事都是它的事。
当前迁移范围定在原始四组能力（47 条规则）。

### 7.1 这与今天的代码矛盾

`AgentWorkspace` 现在接收 `sessionId` + `runtime` 两个 props，
**会话解析、连通性判定、加载/错误/重连态全在宿主**：

- `clients/web/src/components/workspace/AgentPanel.tsx:67-89` —
  `usePodStatus` → `isPodReady` → `useAgentSessionLink` → `useAgentPanelRuntime`，
  四道门（`AgentPanel.tsx:122-161`：PaneLoadingState / PaneErrorState /
  PaneReconnectingState / AgentSessionLinkState）全通过了才挂 `AgentWorkspace`
- `clients/web-user/src/embed-session/EmbeddedAgentWorkspace.tsx:80-115` —
  `createEmbeddedAgentWorkbenchRuntime` 成功才挂，失败自己渲染错误文案

也就是说 agent-ui 今天的契约是"**给我一个已经连好的会话，我渲染对话**"。
按新定位应该是"**给我认证和 worker 标识，我负责连上、判活、重连、渲染**"。

### 7.2 由此产生的契约变化

1. `AgentWorkspace` 入参从 `{ sessionId, runtime }` 变为 `{ auth, workerRef }`，
   runtime 由 agent-ui 内部构造——宿主不再有能力（也不再有义务）先把会话连好
2. 加载 / 错误 / 重连 / 离线四态从宿主移入 agent-ui，
   两个消费方各自的状态视图（`PaneStateViews.tsx`、`WorkspaceState`）随之删除
3. agent-ui 需要会话目录 API，而不只是单会话入口
4. 宿主收缩到只剩：认证、路由、应用外壳

### 7.3 挡在 47 条规则前面的真实冲突

两个消费方对"worker 是否活着"用的是**两套不兼容的模型**：

| | web（pod 模型） | web-user（runner/host 模型） |
|---|---|---|
| 输入 | `podStatus ∈ {running, completed, orphaned}`、`isPodReady`、`initProgress` | `runner_online`、`host_online`、`host_resumable`、`created_at` |
| 判活来源 | pod 状态订阅 | WS 流 + 当前会话 10 秒 `/health` 轮询 |
| 唤醒语义 | 无（pod 要么在跑要么没了） | `*_asleep` 时发送即唤醒 |
| 不可达处理 | 换 Pane 状态视图 | 重连横幅 + CLI 命令 |

第 4.4 节那张八分支真值表是 runner/host 模型的，**套不到 pod 上**。
agent-ui 要拥有判活，就得先把这两个模型统一成一个——否则就是两套判活并存，
正是现在两套后端 journal（`conversation_items` 与 `agent_workbench_events`）的翻版。

传输层没有这个问题：`AgentSessionRuntime` 已经把两种传输抽象掉了
（Connect/protobuf 对 pod，`/v1` REST/SSE 对 omnigent，后者是 F1 加的）。
**冲突只在判活模型这一层。**

这是下一个要定的事，它挡在 47 条规则前面。
