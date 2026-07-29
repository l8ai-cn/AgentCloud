# Schema

数据库是 schema 的 SSOT。本目录不保存迁移脚本，结构变更只能通过明确授权、
留审计的 DoSql 任务直接作用于目标库。

| 文件 | 角色 |
| --- | --- |
| `SCHEMA_VERSION` | 代码期望的 schema 版本，Oilan 发布闸门的唯一版本锚点 |
| `schema.sql` | 权威库的整体快照，只用于给全新的 dev/CI 空库建 schema |

## 变更流程

1. 通过授权的 DoSql 任务在目标库应用结构变更，拿到 `change-id` 与 `operation-id`
2. 递增 `SCHEMA_VERSION`
3. 重新导出 `schema.sql`（见下），让全新库能建出同样的结构
4. 发布时向 `deploy.sh` 提供 `DOSQL_RELEASE_*` 证据；
   `deploy/kubernetes/cluster-oilan/dosql_release_gate.sh` 校验证据里的
   `migrationVersion` 与 `SCHEMA_VERSION` 一致，以此证明库已升到代码期望的版本

版本号只做单调递增计数，不对应任何文件。零填充到 6 位是为了与既有 DoSql
审计证据的格式保持一致。

## 重新导出 schema.sql

`schema.sql` 是数据库的投影，不是变更来源——只能重新导出覆盖，禁止手改，
也禁止把它当迁移链追加使用。导出是只读操作：

```bash
POD=$(doops exec -target gw-oilan-node -session schema-export \
  -cmd "kubectl get pods -n agentcloud --no-headers | grep '^postgres-' | awk '{print \$1}'")

doops exec -target gw-oilan-node -session schema-export -cmd "kubectl exec -n agentcloud $POD -- sh -c \
  'PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" \
   --schema-only --no-owner --no-privileges > /tmp/schema.sql'"
```

然后把 `/tmp/schema.sql` 取回覆盖本文件。注意两点：

- 输出超过约 200KB 会被传输截断，用 `gzip | base64` 分块取回并核对 `md5sum`
- 剥掉 pg_dump 生成的 `\restrict` / `\unrestrict` 两行：其 token 每次导出都变，
  是纯 diff 噪声

导出后应能在空库上干净还原（`psql -v ON_ERROR_STOP=1`），并覆盖 `public`
与 `marketplace` 两个 schema。
