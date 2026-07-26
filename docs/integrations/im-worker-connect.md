# IM Worker Connect

从飞书 / 钉钉 / 企微 / 个人微信（iLink）操作组织内 Worker。设计调研与阶段计划见
[`.claude/plans/im-worker-connect.md`](../../.claude/plans/im-worker-connect.md)。

## 能力边界（已上线）

| 能力 | 说明 |
|---|---|
| 协议 | 飞书 / 钉钉 / 企微 webhook；微信 iLink 扫码 + long-poll |
| 入站 | `@worker-slug` → 结构化 pod mention → `PodPromptHook` |
| 身份 | 配对码绑定 IM 外部用户 ↔ AgentsMesh user；`dm_policy` / `group_policy` / `allow_from` |
| 路由 | `@mention` > `/use` > `im_route_bindings`；`/workers` `/help` `/status` `/new` `/stop` |
| 出站 | 精确定位线程、文本分片、瞬时错误重试；飞书 progress draft（可 Update） |
| 凭据 | `config_encrypted` AES；API 回显 redact |
| 幂等 | `im_inbound_dedupe` |

未上线：飞书 CardKit / 钉钉 AI Card 富卡片；飞书 WS / 钉钉 Stream 长连接 + Redis 选主。

### 群准入语义

`group_policy = allowlist`（默认）下，群消息必须命中以下之一才放行，**空 `allow_from`
不再等于全放行**：

- `allow_from` 命中群 ID、发送者外部 ID、发送者昵称或 `user:<昵称>`，`*` 为通配；
- 连接通过 `channel_id` 固定绑定到某个协作频道；
- 该群此前已建立 `im_thread_mappings`（即更宽策略下已被接纳过）。

群内未完成配对的发送者仍按连接创建者归属，所以放宽到 `open` 等于把 worker 操作权
交给整个群。要恢复旧的宽松行为，显式改 `group_policy = open` 或把 `*` 写进 `allow_from`。

### 失败与连接状态

只有平台永久性拒绝（4xx，凭据吊销 / 应用删除）会把连接置成 `error` 并停止收发；
超时、5xx、429、伪造签名只写 `last_error`，连接保持 `active`。所有平台调用带
15s 超时，重试仅针对瞬时错误且感知 ctx 取消。飞书 / 企微 access token 按租户缓存。

## 用户路径

1. 组织管理员 → 组织设置 → IM / Connections：创建连接、填凭据、设策略与默认 worker 路由。
2. 用户在 IM 私聊首次触达 → 收到配对码。
3. Web → **个人设置 → IM 配对**（`/settings/im-pair`）输入配对码。
4. 群/私聊 `@worker-slug …` 或依赖默认路由；斜杠指令见 `/help`。

Webhook 由平台回调到 Backend（无 JWT，连接 token 校验）。路径挂在 REST webhook 组：
`backend/internal/api/rest/v1/webhooks/im_bridge.go`。

管理 API（需登录，挂在 org 路由下）：

```text
GET/POST   /api/v1/orgs/:org/im-channels
GET/PATCH/DELETE /api/v1/orgs/:org/im-channels/:connectionId
GET/POST   /api/v1/orgs/:org/im-channels/:connectionId/routes
GET        /api/v1/orgs/:org/im-channels/:connectionId/bindings
POST       /api/v1/orgs/:org/im-channels/pair
POST       /api/v1/orgs/:org/im-channels/weixin/qr/start
```

## 代码地图

| 层 | 路径 |
|---|---|
| Provider / Bridge | `backend/internal/service/imbridge/` |
| Domain / Repo | `backend/internal/domain/imbridge/`、`backend/internal/infra/im_bridge_repo*.go` |
| REST | `backend/internal/api/rest/v1/routes_im_bridge.go`、`im_bridge_*.go` |
| Migration | `backend/migrations/000235_im_worker_connect.{up,down}.sql` |
| Org UI | `clients/web/src/components/settings/organization/im/` |
| 个人配对 | `clients/web/src/app/(dashboard)/settings/im-pair/` |
| API client | `clients/web/src/lib/api/imChannelApi.ts`、`imChannelBindingsApi.ts` |

## Oilan 生产部署（`agentsmesh`）

正式 `deploy/kubernetes/cluster-oilan/deploy.sh` 目标命名空间仍是 **`agentcloud`**；
线上负载在 **`agentsmesh`**（Harbor `repo.aiedulab.cn:8443/agentsmesh/*`）。
在完成 [namespace 迁移](../superpowers/plans/2026-07-25-oilan-namespace-migration.md)
之前，IM 热修走下面路径，**不要**对空 `agentcloud` ns 盲跑 `deploy.sh`。

### 已发布坐标（2026-07-26）

| 项 | 值 |
|---|---|
| Namespace | `agentsmesh` |
| Backend image | `repo.aiedulab.cn:8443/agentsmesh/backend:im-worker-connect` |
| Web image | `repo.aiedulab.cn:8443/agentsmesh/web:im-worker-connect` |
| DB | `schema_migrations.version = 235`，`dirty = false` |
| 入口 | https://agents.l8ai.cn 、 https://dowork.l8ai.cn ；配对页 `/settings/im-pair` |
| 分支 | `feat/im-worker-connect-deploy`（CNB：`cnb.cool/l8ai/doworker`） |

含 IM 所需的中间 migration：`000232` rebrand → `000233` SSO → `000234` AMP tenant → `000235` IM。

### 热修重放（backend）— 仅限应急

下面这条路径**绕过发布闸门**：产物不经 `release_source_guard.sh` /
`verify_release_images.sh`，镜像没有 source revision 标签，也不进 digest 锁。
只在生产已经受影响、且正规流水线不可用时使用；用完必须补一次正规构建，把同一
commit 以带 digest 的镜像重新发布，再更新 `deploy/kubernetes/cluster-oilan` 的锁定值。

本机交叉编译 + 以现网镜像为底座，避免本机拉 Docker Hub：

```bash
COMMIT=$(git rev-parse HEAD)
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" \
  -o /tmp/im-deploy/server ./backend/cmd/server

# Dockerfile: FROM .../agentsmesh/backend:<current> ; COPY server /app/server
docker build --platform linux/amd64 -t \
  repo.aiedulab.cn:8443/agentsmesh/backend:im-worker-connect /tmp/im-deploy
docker push repo.aiedulab.cn:8443/agentsmesh/backend:im-worker-connect

SESSION=$(doops session | tr -d '[:space:]')
doops -session "$SESSION" exec --target gw-oilan-node --cmd '
  kubectl -n agentsmesh set image deploy/backend \
    backend=repo.aiedulab.cn:8443/agentsmesh/backend:im-worker-connect
  kubectl -n agentsmesh rollout status deploy/backend --timeout=300s
  kubectl -n agentsmesh exec deploy/backend -- /app/server migrate up
  kubectl -n agentsmesh exec deploy/backend -- /app/server migrate version
  # ALTER 后清掉 Postgres prepared-statement 缓存
  kubectl -n agentsmesh rollout restart deploy/backend
  kubectl -n agentsmesh rollout status deploy/backend --timeout=300s
'
```

### 热修重放（web）

本地 `STANDALONE=1 next build` 后，把 standalone/static/public 打进现网
`agentsmesh/web` 镜像（或完整 `clients/web/Dockerfile`），推
`:im-worker-connect`，再 `kubectl -n agentsmesh set image deploy/web …`。

### 验收探针

```bash
# 外网
curl -sk -o /dev/null -w "%{http_code}\n" https://agents.l8ai.cn/health          # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://agents.l8ai.cn/settings/im-pair # 200

# 集群内（期望 401 = 路由已挂）
kubectl -n agentsmesh exec deploy/backend -- \
  wget -qS -O- http://127.0.0.1:8080/api/v1/orgs/1/im-channels 2>&1 | head

# schema
DB_PASS=$(kubectl -n agentsmesh get secret agentsmesh-secrets \
  -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
kubectl -n agentsmesh exec deploy/postgres -- \
  env PGPASSWORD="$DB_PASS" psql -U agentsmesh -d agentsmesh \
  -c 'SELECT version, dirty FROM schema_migrations;' -c '\dt im_*'
```

业务验收：建连接 → 默认路由 → IM 私聊拿配对码 → `/settings/im-pair` 配对 →
`@worker` 触发 Pod 提示词并回流。

## 回滚

`kubectl -n agentsmesh set image` 指回上一个已知 digest（如 `amp-authz-guards`）即可，
**不要动 DB**：`000235` 是纯增量（新列都带 NOT NULL DEFAULT，新表旧代码不读），旧镜像
配新 schema 可以正常运行。

`migrate down 1` 会 DROP `im_identity_bindings` / `im_route_bindings` /
`im_inbound_dedupe` 并丢掉已有配对与路由，只有在确认要彻底下线 IM 能力时才执行。
跨 `232–234` 的回滚涉及 SSO / AMP 列，需单独评估。
