# agent-ui：Worker 前端设计

状态：设计完成
日期：2026-07-25
改动清单：`2026-07-25-agent-ui-worker-frontend-changeset.md`
规则底座：`2026-07-25-worker-conversation-logic-map.md`

已决：判活取方案 A（不补 host 存活）；会话列表补 cursor 分页。

---

## 1. 约束

`clients/web` 的 pod 通路走 Rust WASM：
`AgentPanel` → `useAgentPanelRuntime` → `getAgentWorkbenchState()`
→ `clients/core/crates/wasm/src/service_agent_workbench.rs`。
Rust 是 web 的业务 SSOT，**agent-ui 不能接管 web 的传输层**。
`clients/web-user` 无 wasm，直连 `/v1` REST + SSE。

边界：**字节传输可插拔，传输之上全部由 agent-ui 拥有。**

```
                    agent-ui 拥有
  ┌──────────────────────────────────────────────┐
  │ 判活投影 · 会话目录 · 未读 · 重连恢复         │
  │ @ 提及 · 历史滚动 · 对话渲染                  │
  └──────────────────────────────────────────────┘
                         │ WorkerTransport（唯一可插拔缝）
        ┌────────────────┴────────────────┐
   omnigent（agent-ui 自带）          pod（web 注入，wasm 背书）
   /v1 REST + SSE                    Connect/protobuf via Rust
```

套壳是把功能逻辑甩给宿主；这里甩出去的只有字节收发，
判活、目录、提及、历史的规则全在 agent-ui，两个传输共用一套。

---

## 2. 判活：四态

方案 A。后端没有独立 host 存活（`host_online` 恒等于 `runner_online`，
`/health` 恒返回 `null`，`host_resumable` 不发），所以**不读 host 信号**，
`asleep` 态删除，"发送即唤醒"明确放弃。

```ts
// worker/liveness/workerLiveness.ts
export type WorkerReadOnlyReason =
  | "permission"        // permission_level === 1 或 pod 控制租约未授予
  | "closed-subagent"   // labels["agent-cloud.closed"] === "true"
  | "native-subagent"   // claude-code-native-ui-subagent
  | "ended";            // pod completed

export type WorkerUnreachable =
  | { reason: "stranded" }                              // runner 已知离线且无 host 可拉起
  | { reason: "launch-failed"; detail: string | null }
  | { reason: "orphaned" };

export type WorkerLiveness =
  | { state: "unknown" }
  | { state: "starting"; progress: string | null }
  | { state: "online"; readOnly: WorkerReadOnlyReason | null }
  | { state: "unreachable"; cause: WorkerUnreachable; recovery: WorkerRecovery[] };
```

渲染契约：

| state | 输入框 | 横幅 | 时间线 |
|---|---|---|---|
| `unknown` | 开放 | 无 | 正常 |
| `starting` | 开放 | 进度 | 正常 |
| `online` | `readOnly` 决定 | 无 | 正常 |
| `unreachable` | 封锁 | 恢复动作 | 只读 |

`unknown` **不得拦截**——未轮询到不等于离线，拦了会在活会话上闪横幅。

### 2.1 omnigent 投影

```ts
// worker/liveness/omnigentLivenessProjection.ts
export const STARTING_GRACE_S = 45;

export interface OmnigentLivenessInput {
  runnerOnline: boolean | undefined;
  hostId: string | null;
  createdAt: number;          // Unix 秒
  runnerEverOnline: boolean;  // 本次挂载是否观察到过在线
  readOnly: WorkerReadOnlyReason | null;
  recovery: WorkerRecovery[];
  now?: () => number;
}

export function projectOmnigentLiveness(i: OmnigentLivenessInput): WorkerLiveness {
  // 1. 隧道已注册是唯一"可以正常聊"的信号
  if (i.runnerOnline === true) return { state: "online", readOnly: i.readOnly };

  // 2. 冷启动宽限。仅当本次挂载从未在线——否则真崩溃会被掩盖 45 秒
  const nowS = (i.now?.() ?? Date.now()) / 1000;
  if (!i.runnerEverOnline && i.createdAt > 0 && nowS - i.createdAt < STARTING_GRACE_S) {
    return { state: "starting", progress: null };
  }

  // 3. 尚未轮询到——不要在可能活着的会话上闪横幅
  if (i.runnerOnline === undefined) return { state: "unknown" };

  // 4. host-bound：后端不提供 host 存活，无从判断它能否被拉起，不猜
  if (i.hostId) return { state: "unknown" };

  // 5. 无 host 可拉起
  return { state: "unreachable", cause: { reason: "stranded" }, recovery: i.recovery };
}
```

原真值表的行 3/3'/3"（host_offline、host_asleep）与行 5（runner_asleep）
在线上本就不可达（详见改动清单 §0.1），此处一并删除，不是能力回退。

### 2.2 pod 投影

pod 状态取值以 `agentpod/pod.go:14-24` 为准。

```ts
// worker/liveness/podLivenessProjection.ts
export interface PodLivenessInput {
  podStatus: "queued" | "initializing" | "running" | "paused"
           | "disconnected" | "orphaned" | "completed" | "terminated" | "error";
  isPodReady: boolean;
  initProgress: string | null;
  podError: string | null;
  controlGranted: boolean;
}

export function projectPodLiveness(i: PodLivenessInput): WorkerLiveness {
  if (i.podError || i.podStatus === "error") {
    return { state: "unreachable", cause: { reason: "launch-failed", detail: i.podError }, recovery: [] };
  }
  if (i.podStatus === "terminated") {
    return { state: "unreachable", cause: { reason: "orphaned" }, recovery: [{ kind: "wait" }] };
  }
  // completed / orphaned stay readable (orphaned = runner restart auto-recovers)
  if (i.podStatus === "completed" || i.podStatus === "orphaned") {
    return { state: "online", readOnly: "ended" };
  }
  if (i.podStatus === "running" && i.isPodReady) {
    return { state: "online", readOnly: i.controlGranted ? null : "permission" };
  }
  return { state: "starting", progress: i.initProgress };
}
```

pod 侧不产出 `stranded`，也不产出 CLI 恢复——**契约允许子集**。

### 2.3 信号源

`/health` 轮询不能省：runner 隧道掉线只更新 DB `Runner.Status`
（`runner/status.go:28-47`），WS 行不会因此重推，只靠流会一直显示在线。

```ts
// worker/liveness/omnigentHealthPoll.ts
const POLL_OK_MS = 10_000;
const POLL_MAX_MS = 60_000;

export function createHealthPoll(fetch: OmnigentFetch, onResult: (m: HealthMap) => void) {
  let delay = POLL_OK_MS;
  // 成功复位 10s，失败 ×2 封顶 60s。集合为空时清掉陈旧条目，
  // 否则切走的会话会留下一个永不更新的 online 判定。
}
```

```ts
// worker/liveness/useRunnerOnlineEdge.ts
// 重连后快照里的 runner-backed 字段（skills、model options）是陈旧的
export function useRunnerOnlineEdge(online: boolean | undefined, refresh: () => void) {
  const prev = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (online === true && prev.current !== true) refresh();
    prev.current = online;
  }, [online, refresh]);
}
```

---

## 3. 契约

```ts
// worker/contracts.ts
export interface WorkerAuth {
  baseUrl: string;
  getAccessToken(): Promise<string>;
  orgSlug?: string;
}

export type WorkerRef =
  | { transport: "pod"; podKey: string }
  | { transport: "omnigent"; sessionId: string };

export type WorkerRecovery =
  | { kind: "cli"; command: string }
  | { kind: "resume-directory"; sourceHostId: string | null }
  | { kind: "fork" }
  | { kind: "wait" };

/** 唯一可插拔缝。只管字节与存活原始信号，不含任何规则。 */
export interface WorkerTransport {
  readonly kind: WorkerRef["transport"];
  resolveSession(ref: WorkerRef): Promise<string>;
  runtimeFor(sessionId: string): AgentSessionRuntime;
  closeSession?(sessionId: string): void;
  // Takes WorkerRef (not sessionId): pod liveness is known before session link.
  subscribeLiveness(ref: WorkerRef, listener: (l: WorkerLiveness) => void): () => void;
  workspaceFiles?: WorkspaceFileSource;
  directory?: WorkerDirectorySource;   // 仅 omnigent
}
```

```ts
// worker/WorkerClient.ts
export class WorkerClient {
  private readonly transports = new Map<WorkerRef["transport"], WorkerTransport>();
  private readonly sessions = new Map<string, Promise<string>>();   // refKey → sessionId
  private readonly runtimes = new Map<string, AgentSessionRuntime>();

  register(t: WorkerTransport): void { this.transports.set(t.kind, t); }

  transportFor(ref: WorkerRef): WorkerTransport {
    const t = this.transports.get(ref.transport);
    if (!t) throw new Error(`no transport registered for ${ref.transport}`);
    return t;
  }

  // 解析结果缓存到 ref 而非 sessionId——pod 的解析要走带重试的网络往返，
  // 同一个 pane 重挂载不应重跑一遍
  resolveSession(ref: WorkerRef): Promise<string> {
    const key = refKey(ref);
    let p = this.sessions.get(key);
    if (!p) {
      p = this.transportFor(ref).resolveSession(ref).catch((e) => {
        this.sessions.delete(key);   // 失败不缓存，允许重试
        throw e;
      });
      this.sessions.set(key, p);
    }
    return p;
  }

  runtimeFor(ref: WorkerRef, sessionId: string): AgentSessionRuntime {
    let r = this.runtimes.get(sessionId);
    if (!r) { r = this.transportFor(ref).runtimeFor(sessionId); this.runtimes.set(sessionId, r); }
    return r;
  }

  release(sessionId: string): void {
    this.runtimes.get(sessionId)?.close(sessionId);
    this.runtimes.delete(sessionId);
  }
}

export function refKey(ref: WorkerRef): string {
  return ref.transport === "pod" ? `pod:${ref.podKey}` : `omnigent:${ref.sessionId}`;
}
```

---

## 4. 目录结构

```
packages/agent-ui/src/worker/
├── contracts.ts
├── WorkerClient.ts
├── index.ts
├── transport/
│   └── omnigentTransport.ts            自带实现，复用 F1 的 OmnigentSessionRuntime
├── liveness/
│   ├── workerLiveness.ts               §2
│   ├── omnigentLivenessProjection.ts   §2.1
│   ├── podLivenessProjection.ts        §2.2
│   ├── omnigentHealthPoll.ts           §2.3
│   ├── useRunnerOnlineEdge.ts          §2.3
│   └── useWorkerLiveness.ts
├── recovery/
│   ├── reconnectCommand.ts             §5
│   └── workerRecoveryOptions.ts        §5
├── directory/
│   ├── workerDirectoryEntry.ts         §6
│   ├── directoryPagination.ts          §6.1
│   ├── directorySocket.ts              §6.2
│   ├── directoryMerge.ts               §6.3
│   ├── activeEntryOverride.ts          §6.4
│   ├── directoryUnseen.ts              §6.5
│   └── useWorkerDirectory.ts
└── react/
    ├── WorkerProvider.tsx
    ├── WorkerConversation.tsx          §7
    └── WorkerLivenessView.tsx

packages/agent-ui/src/conversation/
├── mentions/                           §8
│   ├── mentionToken.ts
│   ├── mentionRanking.ts
│   ├── mentionSerialize.ts
│   ├── nativeCodingAgent.ts
│   ├── workspaceFileSource.ts
│   └── useMentionBrowser.ts
└── history/                            §9
    ├── useHistoryAnchor.ts
    ├── useLoadOlderTrigger.ts
    └── JumpToLatest.tsx
```

---

## 5. 恢复

```ts
// worker/recovery/reconnectCommand.ts
// host_offline 分支删除（方案 A：该状态不可达），只剩 stranded
export function buildReconnectCommand(i: {
  sessionId: string; serverUrl: string; wrapper: string | null;
}): string {
  const lines = ["runner run \\", `  # resume session ${i.sessionId}`, `  # server: ${i.serverUrl}`];
  if (i.wrapper !== "claude-code-native-ui") {
    lines.push("  # or re-open the session from Agent Cloud web UI");
  }
  return lines.join("\n");
}
```

```ts
// worker/recovery/workerRecoveryOptions.ts
export function recoveryOptionsFor(cause: WorkerUnreachable, ctx: RecoveryContext): WorkerRecovery[] {
  if (cause.reason !== "stranded") return cause.reason === "orphaned" ? [{ kind: "wait" }] : [];
  const out: WorkerRecovery[] = [{ kind: "cli", command: buildReconnectCommand(ctx) }];
  // 未绑定 fork：有 fork.source_id 标签且未绑工作区，走目录选择而非重连
  if (ctx.isUnboundFork) out.push({ kind: "resume-directory", sourceHostId: ctx.sourceHostId });
  out.push({ kind: "fork" });
  return out;
}
```

`isUnboundFork` 依赖 `workspace` 字段，后端已声明未填
（`session_list_wire.go:22`）——改动清单 5 号补上。

---

## 6. 会话目录

```ts
// worker/directory/workerDirectoryEntry.ts
export interface WorkerDirectoryEntry {
  ref: WorkerRef;
  title: string;
  agentLabel: string;
  status: AgentSessionStatus;
  liveness: WorkerLiveness["state"];
  updatedAt: number;
  archived: boolean;
  unseen: boolean;
  pendingPermissions: number;
  permissionLevel: number | null;
  workspace: string | null;
  labels: Record<string, string>;
}
```

### 6.1 分页（keyset）

后端补 cursor 后的契约：

```
GET /v1/sessions?limit=20&cursor=<opaque>&project=&include_archived=
→ { data: [...], has_more: bool, next_cursor: string | null }
```

**必须是 keyset 不能是 offset**：排序键 `updated_at` 会随消息不断变动，
offset 分页在翻页途中会漏行和重复行。

```ts
// worker/directory/directoryPagination.ts
export interface DirectoryCursor { updatedAt: number; id: string; }

export function encodeCursor(c: DirectoryCursor): string {
  return btoa(`${c.updatedAt}:${c.id}`);
}

// 翻页途中若某行 updated_at 被顶到游标之前，它会在本次翻页里缺席。
// 这是 keyset 的固有性质，不是 bug——它会在下次对账轮询里回到列表顶部。
export function nextCursorFrom(page: WorkerDirectoryEntry[]): DirectoryCursor | null {
  const last = page[page.length - 1];
  return last ? { updatedAt: last.updatedAt, id: entryId(last) } : null;
}
```

对应后端：`WHERE (updated_at, id) < (:updated_at, :id) ORDER BY updated_at DESC, id DESC LIMIT :limit + 1`，
多取一条判 `has_more`。

### 6.2 WS

```ts
// worker/directory/directorySocket.ts
const RECONNECT_BASE_MS = 250;
const RECONNECT_MAX_MS = 5_000;
const WATCHDOG_MS = 70_000;   // 后端心跳 30s，两拍未到即重连

export type DirectoryFrame =
  | { type: "snapshot"; items: WireEntry[] }
  | { type: "changed"; items: WireEntry[] }
  | { type: "removed"; ids: string[] }      // 后端待补（改动清单 3 号）
  | { type: "heartbeat" };

// watch 集合比较必须序无关，否则每次 cache 变动都会重发 watch 触发全量 snapshot
export function watchSetEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((id) => s.has(id));
}

export function reconnectDelay(attempt: number, random = Math.random): number {
  const base = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
  return base * (0.5 + random());   // ±50% 抖动，避免雪崩重连
}
```

### 6.3 合并

字段级增量覆盖，不是整表替换。

```ts
// worker/directory/directoryMerge.ts
export function needsResort(changed: ReadonlySet<keyof WorkerDirectoryEntry>, isActiveRow: boolean): boolean {
  if (changed.has("archived")) return true;
  if (changed.has("title")) return true;
  // 活跃行位置由 activeEntryOverride 钉住，它的 updatedAt 抖动不改变可见顺序。
  // 不豁免的话用户每打一个字都会触发一次全量 refetch。
  return changed.has("updatedAt") && !isActiveRow;
}

export function mergeFrame(state: DirectoryState, frame: DirectoryFrame, activeId: string | undefined) {
  // watch 集里出现但缓存中没有的 id 视为结构性新增 → 交给防抖 refetch。
  // 不猜它该插在服务端排序的哪个位置，否则会和下一次分页结果打架。
}
```

**后端 WS 行不带 `permission_level` / `owner` / `viewer_last_seen` / `viewer_unread`**
（`session_updates_hub.go:105-112` 未走 `enrichOwnership`）。合并前必须按字段白名单
过滤 wire 行，否则这些字段会被 `undefined` 覆盖掉。改动清单 2 号补后端后可放宽。

### 6.4 活跃行冻结

```ts
// worker/directory/activeEntryOverride.ts
// 进入会话时快照它的 updatedAt 作为排序键，离开时清除。
// 否则用户一边打字，自己正在看的会话一边在列表里往上跳。
export function sortEntries(
  entries: readonly WorkerDirectoryEntry[],
  override: { id: string; updatedAt: number } | null,
): WorkerDirectoryEntry[] {
  const keyOf = (e: WorkerDirectoryEntry) =>
    override && entryId(e) === override.id ? override.updatedAt : e.updatedAt;
  return [...entries].sort((a, b) => keyOf(b) - keyOf(a) || entryId(a).localeCompare(entryId(b)));
}
```

排序加 id 兜底，与后端 keyset 的 `(updated_at, id)` 一致，避免同秒行前后端不同序。

### 6.5 未读

```ts
// worker/directory/directoryUnseen.ts
export function isUnseen(e: WorkerDirectoryEntry, lastSeen: ReadonlyMap<string, number>): boolean {
  if (e.status !== "idle" && e.status !== "failed") return false;   // 还在跑的不算未读
  const seen = lastSeen.get(entryId(e));
  if (seen === undefined) return false;   // 无基线视为已读，否则重启后整列标红
  return e.updatedAt > seen;
}

/** 首次 seed 前禁用自动标记已读，否则深链进入会清掉跨设备未读 */
export function canAutoMarkSeen(hydrated: boolean, explicitlyUnread: ReadonlySet<string>, id: string) {
  return hydrated && !explicitlyUnread.has(id);
}

/** 显式"标为未读"把基线压到 updatedAt - 1，让它重新满足 > 判定 */
export function markUnreadBaseline(e: WorkerDirectoryEntry): number {
  return e.updatedAt - 1;
}
```

基线读写走后端 `GET/PUT /v1/sessions/{id}/read-state`（`session_read_state.go:10-54`），
已存在，无需改动。

**不迁**：侧栏五分区、置顶顺序与 localStorage、拖拽归档、worker×project 视觉分组。

---

## 7. 组件

```tsx
// worker/react/WorkerConversation.tsx
export function WorkerConversation({ workerRef, presentation, className }: {
  workerRef: WorkerRef;
  presentation: "developer" | "user";
  className?: string;
}) {
  const client = useWorkerClient();
  const { sessionId, runtime, resolveError } = useWorkerSession(client, workerRef);
  const liveness = useWorkerLiveness(client, workerRef, sessionId);

  if (resolveError) {
    return <WorkerLivenessView liveness={{
      state: "unreachable",
      cause: { reason: "launch-failed", detail: resolveError },
      recovery: [],
    }} />;
  }
  if (!sessionId || !runtime) {
    return <WorkerLivenessView liveness={{ state: "starting", progress: null }} />;
  }
  if (liveness.state === "starting" || liveness.state === "unreachable") {
    return <WorkerLivenessView liveness={liveness} workerRef={workerRef} />;
  }

  return (
    <AgentWorkspace
      className={className}
      presentation={presentation}
      readOnly={liveness.state === "online" && liveness.readOnly !== null}
      runtime={runtime}
      sessionId={sessionId}
    />
  );
}
```

方案 A 下 `asleep` 消失，`AgentWorkspace` **不需要 `wakeHint` prop**——原设计里那条改动取消，
`AgentWorkspace` 完全不动。

**web `AgentPanel` 切换后**：

```tsx
<WorkerConversation workerRef={{ transport: "pod", podKey }} presentation="developer" />
```

---

## 8. `@` 文件提及

```ts
// conversation/mentions/mentionToken.ts
// "@" 在串首或空白后，跟一段无空白无 "@" 的字符，直到光标
const MENTION_RE = /(?:^|\s)@([^\s@]*)$/;

export function detectMentionAt(text: string, caret: number): MentionState | null {
  const m = MENTION_RE.exec(text.slice(0, caret));   // 只看光标前，尾随空格即关闭菜单
  if (!m) return null;
  return { query: m[1], start: caret - m[1].length - 1, end: caret };
}

/** "src/fo" → 浏览 src 过滤 fo；"src/" → 浏览 src 无过滤；"fo" → 浏览根过滤 fo */
export function parseMentionToken(query: string): { dir: string; filter: string } {
  const slash = query.lastIndexOf("/");
  return slash >= 0
    ? { dir: query.slice(0, slash), filter: query.slice(slash + 1) }
    : { dir: "", filter: query };
}
```

```ts
// conversation/mentions/mentionRanking.ts
export const MENTION_MATCH_CAP = 50;

export function rankMentionEntries<T extends { name: string; type: string }>(
  entries: readonly T[], filter: string, cap = MENTION_MATCH_CAP,
): T[] {
  const needle = filter.toLowerCase();
  return entries
    .filter((e) => e.name.toLowerCase().includes(needle))
    .sort((a, b) => (a.type !== b.type ? (a.type === "directory" ? -1 : 1) : a.name.localeCompare(b.name)))
    .slice(0, cap);   // 只截渲染列表，不截真正投递的内容
}
```

```ts
// conversation/mentions/mentionSerialize.ts
export function mentionItemPath(item: MentionItem): string {
  if (item.lineRange) return `${item.path}:${item.lineRange.start}-${item.lineRange.end}`;
  return item.isDir ? `${item.path}/` : item.path;
}

// codex executor 写 "[Attached file:"，claude/pi/cursor 写 "[Attached:"。
// 跟 vendor 自己的措辞一致，codex 镜像回来的 transcript 才对得上。
export function mentionMarkerFor(harness: string | null, path: string): string {
  return nativeCodingAgentForHarness(harness)?.key === "codex"
    ? `[Attached file: ${path}]` : `[Attached: ${path}]`;
}

export function buildMentionPreamble(items: readonly MentionItem[], harness: string | null): string {
  if (items.length === 0) return "";
  return items.map((i) => mentionMarkerFor(harness, mentionItemPath(i))).join("\n") + "\n\n";
}
```

```ts
// conversation/mentions/workspaceFileSource.ts
export interface WorkspaceFileEntry {
  name: string; path: string; type: "file" | "directory";
}

export interface WorkspaceFileSource {
  list(sessionId: string, dir: string): Promise<WorkspaceFileEntry[]>;
  exists?(sessionId: string, path: string): Promise<boolean>;
}
```

- omnigent：`/v1/sessions/{id}/resources/environments/{env}/filesystem[/{path}]?limit=1000&order=asc`
- pod：需后端补 list op（改动清单 1 号），响应形状对齐 session 侧

`useMentionBrowser` 的键盘状态机：上下选择、Tab 补目录并保持菜单打开、
Enter 提交、Esc / 空格 / 失焦关闭、去重键 `path|isDir|start-end`。

---

## 9. 历史滚动

F1 已实现取数（`fetchOmnigentInitialHistory`、`loadOlder`），这期只做滚动侧。

```ts
// conversation/history/useHistoryAnchor.ts
// 插入旧页会把内容往下推，不补偿的话视口会跳到几屏之外。
// 必须在 DOM 提交后、浏览器绘制前补偿，用 useLayoutEffect。
export function useHistoryAnchor(el: RefObject<HTMLElement>, itemCount: number, loadingOlder: boolean) {
  const before = useRef<{ height: number; top: number } | null>(null);
  if (loadingOlder && el.current && !before.current) {
    before.current = { height: el.current.scrollHeight, top: el.current.scrollTop };
  }
  useLayoutEffect(() => {
    const node = el.current, prev = before.current;
    if (!node || !prev) return;
    node.scrollTop = prev.top + (node.scrollHeight - prev.height);
    before.current = null;
  }, [itemCount]);
}
```

```ts
// conversation/history/useLoadOlderTrigger.ts
const TRIGGER_PX = 300;

// 在途去重：翻页是异步的，滚动事件会在同一次到顶时连发多次
export function useLoadOlderTrigger(
  el: RefObject<HTMLElement>, hasOlder: boolean, loadOlder: () => Promise<void>,
) {
  const inFlight = useRef(false);
  // scrollTop < TRIGGER_PX && hasOlder && !inFlight → 触发
}
```

`JumpToLatest` 出现条件：距底超过一屏且期间有新条目。切换会话时滚动位置重置到底部。

---

## 10. 分期

| 期 | 内容 | 后端阻塞 |
|---|---|---|
| P1 | §3 契约 + `WorkerClient` + §2.2 pod 投影 + §7 组件；web `AgentPanel` 切换 | 无 |
| P2 | §2.1 omnigent 投影 + §2.3 轮询 + §5 恢复 | 无（方案 A） |
| P3 | §8 提及 | pod 目录列举 op |
| P4 | §9 历史滚动 | 无 |
| P5 | §6 目录 | WS enrichOwnership、`removed` 帧、cursor 分页、`workspace` 字段 |

P1 先切 pod：两个传输里简单的那个（无 stranded、无 CLI 恢复、无目录），
用它验证边界翻转成立，再上 omnigent。P5 最后，体量最大且不阻塞其它期。

---

## 11. 测试

- 纯函数（两个投影、`needsResort`、`isUnseen`、`sortEntries`、三个 mention 模块、
  `reconnectDelay`）直接单测，这是规则密度最高的部分
- `WorkerClient` 与传输用 F1 已有的 `OmnigentTestServer` 扩展
- pod 传输在 `clients/web` 侧测，wasm 打桩
- 滚动锚定需 jsdom polyfill，`test-setup.ts` 已有 `scrollTo` / `scrollIntoView`

---

## 12. 明确不做

- 渲染器与审批流（约 28 条规则）
- native-terminal 分叉（8 条规则）——属 agent-ui 职责但不在本期
- 成本路由、Codex Goal、语音听写、回复引用链——web-user 产品控件
- POST events 的 `denied` 分支、SSE `?idle=` presence——后端从未实现，删前端
- 两套后端 journal 的统一
