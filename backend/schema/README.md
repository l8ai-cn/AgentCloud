# Schema Version Anchor

`SCHEMA_VERSION` 是代码期望的数据库 schema 版本，也是 Oilan 发布闸门
(`deploy/kubernetes/cluster-oilan/dosql_release_gate.sh`) 的唯一版本锚点。

本仓库不保存数据库 schema 定义，也不保存 SQL 迁移脚本。数据库是 schema 的
SSOT，结构变更只能通过明确授权、留审计的 DoSql 任务直接作用于目标库。

## 变更流程

1. 通过授权的 DoSql 任务在目标库应用结构变更，拿到 `change-id` 与 `operation-id`
2. 递增 `SCHEMA_VERSION`
3. 发布时向 `deploy.sh` 提供 `DOSQL_RELEASE_*` 证据；闸门校验证据里的
   `migrationVersion` 与本文件一致，以此证明库已升到代码期望的版本

版本号只做单调递增计数，不再对应任何迁移文件。零填充到 6 位是为了与既有
DoSql 审计证据的格式保持一致。
