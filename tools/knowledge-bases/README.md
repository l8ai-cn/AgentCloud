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

| slug | 院校 | 官方来源 |
|---|---|---|
| `zhejiang-conservatory-of-music` | 浙江音乐学院 | https://www.zjcm.edu.cn |
| `zstu-keyi-college` | 浙江理工大学科技与艺术学院 | https://zs.ky.zstu.edu.cn |

校名易错点：第二所的正式名是「科技与艺术学院」，不是「科学与艺术学院」。

## Provision 到平台

平台没有批量导入 API，知识库内容落地有两条路径：

1. `CreateKnowledgeBase` Connect RPC 建库（自动 scaffold llms.txt / AGENTS.md /
   raw/ / wiki/），再用 Gitea batch contents API 提交本目录的文件覆盖 scaffold
2. 建库后以 rw 模式挂载到 Pod，由 agent 在 Pod 内 git commit + push

两条都需要目标组织的凭证，本目录不保存任何凭证。
