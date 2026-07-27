# Zhiyong × AgentCloud（Oilan）落地清单

Zhiyong 侧已接 `embed-grant` + dock iframe。上线还差这些运维项：

## 1. AgentsMesh 部署含 embed API

确认 `agents.l8ai.cn` 已包含：

- `POST /api/v1/ext/orgs/{org}/workers/{key}/embed-context`
- API Key scope `sessions:embed`
- 组织内伙伴：`learning-companion-partner`、`teacher-assistant-partner`

## 2. iframe 宿主（web / agents.l8ai.cn）

`iframe_base` 指向 `https://agents.l8ai.cn`（与 AgentsMesh API 同域，路由
`/iframe` 与 compat `/iframe.html`）。该 origin 必须能访问 `/v1` 与 Connect。

本地联调：`iframe_base=http://localhost:10007`。

## 3. ConfigMap 写入 API Key（不用 Secret）

编辑 Helm ConfigMap 源文件：

`deploy/helm/oilan/files/zhiyong-ai-api.config.json`

```json
"agentcloud": {
  "api_base": "https://agents.l8ai.cn",
  "org_slug": "l8ai",
  "api_key": "amk_...",
  "iframe_base": "https://agents.l8ai.cn",
  "partners": ["teacher-assistant"],
  "parent_origins": [ "...zhiyong origins..." ]
}
```

部署后挂载为 `zhiyong-ai-api-config` → `/app/config/zhiyong-ai-api.config.json`。
`api_base` / `org_slug` / `api_key` / `iframe_base` 四项齐全即启用 embed；要临时关掉
加 `"enabled": false`。

`partners` 是分阶段上线的开关：留空 = 两个伙伴都走 embed；只填
`["teacher-assistant"]` 时学伴仍跑老的 lab-api worker。学伴要上线就加
`"learning-companion"`，此时学伴空间变成「左侧 AgentCloud 对话 + 右侧知识图谱 / Wiki」，
领域 UI 的数据来自同一个 worker 沙箱（见下）。

当前分级：`deploy/helm/test/files/zhiyong-ai-api.config.json` 两个伙伴都开
（`api_key` 留空，填入后才真正生效）；oilan 仍只有 teacher-assistant，等 test 跑通再放。

组织用 **`l8ai`**（不是 `dev-org`）。在 https://agents.l8ai.cn/l8ai 以该组织成员登录后创建 API Key，
scopes：`experts:read/write`、`pods:read/write`、`sessions:embed`（后一项需 AgentsMesh 已部署 embed 改动）。

## 4. 教师助理 = AgentCloud 集成（无 AMP fallback）

`/v1/teacher-assistant` 只剩：

| 端点 | 行为 |
|---|---|
| `GET  /embed-mode` | `{embed_mode: active_for("teacher-assistant")}` |
| `POST /embed-grant` | 签发 grant；未配置则 503 |

已删除：AMP worker ensure、runtime/workspace 代理、`/chat/run` SSE。前端
`/teacher-assistant`、dock 的 teacher-assistant/tutor 模式、CodeAssistantDock TA
模式一律挂 `AgentCloudEmbedPanel`。知识图谱「生成」改为跳转工作台（prompt 写入剪贴板）。

## 5. 学伴 = AgentCloud 对话 + 领域 UI

学伴列入 `partners` 后：

- 对话在 `AgentCloudEmbedPanel`（iframe）里跑，不再走 lab-api 的 `/chat/run`。
- 知识图谱 / Wiki 资料由 `/v1/learning-companion` 的只读端点提供，这些端点在 embed
  模式下改读 AgentCloud worker 沙箱（`workspace/search` + `workspace/files/*`），
  再按老的 snapshot 结构投影出 graph / nodeStates / documents。
- 写入类端点（投喂资料、出题、重建、练习提交）仍是 lab-api 语义，embed 模式下不暴露
  入口；学生直接在对话里让学伴做这些动作，产物写回同一个 wiki。

前置：API Key 需要 `pods:read`（读工作区）。ai-api 按 alias 只认**活着的**实例，
实例被回收时领域 UI 拿到空图谱而不是报错；重新进入页面会按 alias 重新拉起。

探测未完成前（`embed_mode === null`）两条路径都不挂载，避免出现双工作区。
