# Oilan 生产命名空间迁移：agentsmesh → agentcloud

状态：**已执行（2026-07-26）**。

## 结果

| | 迁移后 |
|---|---|
| Namespace | `agentcloud`（`agentsmesh` 已不存在） |
| Secrets / ConfigMap | `agentcloud-*` |
| Ingress | `agentcloud-*`（含 `agents.l8ai.cn` relay/tunnel） |
| PVCs | 4 个 local-path 卷 Retain 后 rebound 到 `agentcloud` |
| DB 物理身份 | 仍为 `agentsmesh` / `agentsmesh`（未改角色与库名） |
| Harbor 镜像项目 | 仍为 `…/agentsmesh/*`（未 retag） |
| `PRIMARY_DOMAIN` | `agents.l8ai.cn` |
| schema | `236`，`dirty=false` |
| backend/web | `*:im-locale-bindings`（含 IM locale/bindings） |

## 执行方式

脚本：`deploy/kubernetes/cluster-oilan/migrate_namespace_to_agentcloud.sh`
（中断后续跑 `migrate_namespace_to_agentcloud_resume.sh`）。

要点：

1. `pg_dump` 备份落在 doops workspace。
2. PV `Retain` → 删旧 PVC → 在 `agentcloud` 用 `volumeName` 重绑。
3. Secret/ConfigMap/Deploy/Service/Ingress 资源名 `agentsmesh-*` → `agentcloud-*`；
   **不改** `POSTGRES_USER` / `DB_NAME` / `STORAGE_BUCKET` / Harbor 路径。
4. `deploy.sh` 已加幽灵 ns 防护（无 `postgres-data` 则拒绝，除非 `ALLOW_FRESH_NAMESPACE=1`）。

## 偏差 / 风险

- 迁移 plan 原要求 **48 小时后再删** `agentsmesh`。执行过程中该命名空间
  已被删除，回滚只能依赖 Retain PV + `pg_dump` 备份，不能再「扩回旧 Deployment」。
- Harbor 部分 digest 对 pull 已 NotFound，靠节点本地缓存 + `imagePullPolicy=IfNotPresent`
  拉起了 marketplace / web-admin / runner-video-studio。后续应重新推送不可变 digest。
- web-admin 容器监听 **3001**，Service `targetPort` 已改为 3001。

## 验收（外网）

| URL | 期望 |
|---|---|
| https://agents.l8ai.cn/health | 200 |
| https://agents.l8ai.cn/relay/health | 200 |
| https://agents.l8ai.cn/.well-known/jwks.json | 200 |
| https://agents.l8ai.cn/settings/im-pair | 200 |
| https://dowork.l8ai.cn/health | 200 |
| https://market.l8ai.cn/ | 200 |
| https://admin.l8ai.cn/ | 200 |
| https://mobile.l8ai.cn/ | 200 |
