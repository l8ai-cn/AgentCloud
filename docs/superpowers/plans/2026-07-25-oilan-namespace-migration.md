# Oilan 生产命名空间迁移方案：agentsmesh → agentcloud

状态：**待批准，未执行**。本文只描述方案，不含可直接粘贴执行的破坏性命令。

## 1. 为什么需要它

commit `1ddf60d4a`（rebrand: Do Worker/AgentsMesh -> Agent Cloud）把
`deploy/kubernetes/cluster-oilan/` 的命名空间与 secret 名从 `agentsmesh` 改成
`agentcloud`，但生产从未随之迁移。当前状态：

| | 仓库 manifests | 线上实际 |
|---|---|---|
| Namespace | `agentcloud` | `agentsmesh`（18 天） |
| Secrets | `agentcloud-*` | `agentsmesh-secrets` / `-pki-ca` / `-access-token` / `-regcred` / `-gitea` |
| ConfigMap | `agentcloud-config` / `-seed` | `agentsmesh-config`（47 键）/ `agentsmesh-seed` |
| DB user / dbname | `agentcloud` | `agentsmesh` |
| Ingress | `agentcloud-*` | `agentsmesh-*`（11 条） |

**当前隐患**：按现在的 manifests 执行 `deploy.sh`（`NS=agentcloud`）会在一个空的新
命名空间里起一整套服务，挂空卷，而线上那套不受影响也不被更新。在迁移完成前，
任何人跑 `deploy.sh` 都会产生一套幽灵环境。

## 2. 已核实的迁移面

### 2.1 有状态卷（4 个，`local-path` / RWO / 节点本地）

| PVC | 容量 | 内容 |
|---|---|---|
| `postgres-data` | 20Gi | 主库，`schema_migrations` 231 |
| `minio-data` | 20Gi | 对象存储 |
| `gitea-data` | 10Gi | 内置 Gitea 仓库 |
| `redis-data` | 5Gi | 缓存，可丢弃重建 |

PVC 是 namespace 作用域的，**新命名空间必然拿到空卷**。`local-path` 是节点本地目录，
无法跨命名空间 rebind，只能逻辑导出/导入或在节点上复制底层目录。

### 2.2 PKI（风险低于预期）

`runners` 表 19 行，`cert_serial_number` **全部为 NULL** —— 没有任何已签发的 mTLS
客户端证书。8 个 online runner 都是集群内 `runner-*` Deployment，随迁移一起重建即可。
`agentsmesh-pki-ca` 仍需原样搬过去以保持 CA 连续性，但不存在"外部自托管 runner 集体掉线"
这一风险。

### 2.3 Ingress（真实停机点）

11 条 `agentsmesh-*` ingress 占用生产域名：`dowork.l8ai.cn`（含 relay 与 tunnel 两条额外规则）、
`market.l8ai.cn`、`admin.l8ai.cn`、`mobile.l8ai.cn`、`agents.l8ai.cn`、`preview.l8ai.cn`、
`minio.dowork.l8ai.cn`。同一 host 不能被两个命名空间的 ingress 同时稳定持有，
ingress-nginx 会按最早创建者裁决——所以**必须先删旧再建新**，这段窗口对外 502/404。

### 2.4 其它

- `agentsmesh-config` 47 个键需逐键 diff，其中含内部 Gitea 的 in-cluster URL
  （`*.agentsmesh.svc.cluster.local`），跨命名空间后必须改写。
- Backend 的 in-cluster DNS 依赖 `postgres` / `redis` / `minio` / `gitea` 短名，
  同命名空间内解析，迁移后自动跟随，无需改。
- `60-prepull-daemonset.yaml` 产生的 `agentsmesh-image-prepull-*` 可直接重建。

## 3. 执行方案

### 阶段 0：先关掉误部署风险（可独立先做，无停机）

在 `deploy.sh` 加一道前置断言：目标命名空间若不存在、或存在但缺少 `postgres-data` PVC，
则报错退出并提示需显式传 `ALLOW_FRESH_NAMESPACE=1`。这样在迁移落地前，
任何人跑 `deploy.sh` 都不会静默造出幽灵环境。

### 阶段 1：准备（无停机）

1. 走 DoSql 变更流程做一次全量 `pg_dump`，落到集群外，校验 checksum 并试恢复一次。
2. `mc mirror` 导出 MinIO 全量桶；`tar` 打包 Gitea data。
3. 把 5 个 `agentsmesh-*` secret 导出、改名为 `agentcloud-*`，`agentsmesh-config`
   逐键 diff 后生成 `agentcloud-config`，改写其中的 in-cluster Gitea URL。
4. 建 `agentcloud` 命名空间 + PVC + secret/configmap，**先不建 ingress**。
5. 起 postgres / redis / minio / gitea，导入备份，用只读查询校验：
   `schema_migrations` = 231、`provider_connections`/`model_resources` 行数、MinIO 桶
   对象数、Gitea 仓库数，全部与旧命名空间一致。

此时两套并存，新的没有对外入口。

### 阶段 2：切换（停机窗口，预计 15–30 分钟）

1. 公告 + 冻结写入（沿用 `deploy-write-quiescence.sh`）。
2. 把旧命名空间 backend / relay / marketplace / web / web-admin / mobile / runner-\*
   缩到 0，确认无活跃写入。
3. 做一次**增量** dump 并导入新库（覆盖阶段 1 之后产生的增量）。
4. 删除 11 条 `agentsmesh-*` ingress，随后在 `agentcloud` 创建对应 ingress。
5. 起新命名空间全部无状态服务，验收：`/health`、登录、`dowork.l8ai.cn` 首页、
   market / admin / mobile，以及 runner 重新上线心跳。

### 阶段 3：回滚与收尾

- 回滚点：阶段 2 第 4 步之前，删掉新 ingress、把旧 ingress 建回、旧 Deployment 扩回原副本，
  旧命名空间的卷始终未被触碰。
- 阶段 2 第 3 步之后若回滚，新库产生的增量作废——这是本方案唯一的单向门，
  必须在窗口内确认验收再放行。
- 观察 48 小时后再删除 `agentsmesh` 命名空间及其 4 个卷。**不要当天删。**

## 4. 更省的替代方案（推荐重新评估）

把 Kubernetes 身份当作不可变基础设施：将 `deploy/kubernetes/cluster-oilan/` 的
namespace 与 secret 名回对齐到 `agentsmesh`，rebrand 只保留在产品层面。
代价是约 40 个文件的机械改动、零停机、零数据搬迁，并部分反转 `1ddf60d4a`。
`.agents/skills/dosql` 已按这个策略处理：逻辑资产名保留 `db_agentcloud_prod_postgres`，
物理坐标写实际的 `agentsmesh`。
