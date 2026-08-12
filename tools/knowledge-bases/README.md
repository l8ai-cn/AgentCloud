# 院校知识库暂存区

Agent Cloud 知识库的权威内容存放在内部 Gitea（`am-kb/org{orgID}-{slug}`），
不在本仓库。这个目录只是**内容创作与评审的暂存区**：在这里把 `raw/` 与
`wiki/` 写好、评审通过，再 provision 到目标组织的知识库。

## 为什么需要暂存区

知识库一旦挂载给 agent，其中的事实会被直接写进交付物（课程材料、对外文案、
招生答复）。一条错事实不会报错，只会安静地流进成果物。所以院校类知识库的
内容必须先经人工评审，不能让 agent 直接对着互联网往生产知识库里写。

## 目录约定

```
tools/knowledge-bases/
├── AGENTS.institution.md          # 院校类知识库的维护契约，provision 时作为 AGENTS.md 写入
├── CONTRADICTIONS.md              # 跨院校的矛盾台账（官方来源自相矛盾的记录）
└── <kb-slug>/
    ├── raw/official/              # 官方原文快照，带溯源 frontmatter，不可加工
    │   └── SOURCES.md             # 该库原始资料汇总表
    └── wiki/                      # 面向任务的加工页面
```

`<kb-slug>` 必须满足 `backend/pkg/slugkit` 的 identifier 规则
（`^[a-z0-9]+(-[a-z0-9]+)*$`），因为它会成为知识库的 slug 与 Gitea 仓库名的一部分。

## 当前知识库

按**内容域 × 更新节奏**拆库，而不是一所院校一个大库。事实型与时序型内容混在
同一个库里，agent 检索时会互相干扰：查办学定位时被上周的演出通知淹没，查近期
动态时又被沿革史料稀释。

| slug | 院校 | 内容域 | 更新节奏 |
|---|---|---|---|
| `zhejiang-conservatory-of-music` | 浙江音乐学院 | 院校事实（沿革、院系、专业、学科、设施、话语体系） | 低频，学年级 |
| `zhejiang-conservatory-of-music-news` | 浙江音乐学院 | 新闻公告、演出活动、通知 | 高频，周级 |
| `zstu-keyi-college` | 浙江理工大学科技与艺术学院 | 院校事实 | 低频，学年级 |
| `zstu-keyi-college-news` | 浙江理工大学科技与艺术学院 | 新闻公告、通知 | 高频，周级 |

校名易错点：后者的正式名是「科技与艺术学院」，不是「科学与艺术学院」。

事实库与新闻库的差别不只是内容，还包括契约：事实库要求逐字照录与矛盾登记，
新闻库额外要求每条带发布日期、保留时序、并明确区分「已发生」与「预告」。

## 新鲜度的现实约束

平台的知识库 connector 只支持 `git` / `feishu` / `dingtalk` / `google`
（见 `backend/internal/domain/knowledgebase` 的 `SourceType*` 与
`service/knowledgebase/connector/`），**没有网站抓取或 RSS 类 connector**。

因此新闻库的 `source_type` 只能是 `git`，新鲜度靠定期跑一次 ingest agent 往
`raw/` 追加快照来维持，而不是 `sync_worker` 自动拉取。周期性触发需要外部调度。

## Provision 到平台

平台没有批量导入 API，知识库内容落地有两条路径：

1. `CreateKnowledgeBase` Connect RPC 建库（自动 scaffold llms.txt / AGENTS.md /
   raw/ / wiki/），再用 Gitea batch contents API 提交本目录的文件覆盖 scaffold
2. 建库后以 rw 模式挂载到 Pod，由 agent 在 Pod 内 git commit + push

两条都需要目标组织的凭证，本目录不保存任何凭证。
