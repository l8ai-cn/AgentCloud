# 内置伙伴目录与市场发布设计

- 状态：持续维护
- 产品名称：内置伙伴目录
- 技术资源名：Operator Catalog Expert
- 适用范围：视频、花型设计、课程研发等平台内置伙伴的初始化、市场发布和安装

## 1. 目标

内置目录把平台预置能力以“伙伴”交付给组织，而不是把用户暴露给底层 Worker
配置。当前目录必须满足：

1. 用户可见名称全部使用“伙伴”，不再出现“专家”。
2. 每个伙伴都有稳定 slug、职责、能力、交付物、图标和可运行 WorkerSpec。
3. 市场发布快照可移植，不携带发布组织的密钥、环境包、仓库或知识库私有引用。
4. 组织内伙伴可以绑定本组织凭据；市场安装时再由目标组织按合同选择凭据。

## 2. 当前内置伙伴

| 伙伴 | slug | Worker 类型 | 市场分类 | 图标 | 必需外部凭据 |
| --- | --- | --- | --- | --- | --- |
| 视频制作伙伴 | `video-production-expert` | `video-studio` | `video` | `clapperboard` | 无 |
| 视频剪辑伙伴 | `video-editing-expert` | `video-studio` | `video` | `scissors` | 无 |
| 短视频编导伙伴 | `short-video-director` | `video-studio` | `video` | `film` | 无 |
| 花型设计伙伴 | `pattern-design-partner` | `pattern-designer` | `design` | `palette` | `lovart` |
| 课程研发伙伴 | `course-development-partner` | `codex-cli` | `education` | `graduation-cap` | 无 |

`slug` 是技术标识，不强制重命名历史视频 slug。用户界面只展示伙伴名称。

## 3. 能力组合

视频伙伴复用视频生产技能：

- `seedance-expert`
- `short-video-directing`
- `video-editing-workflow`
- `remotion-video-production`
- `video-motion-graphics`
- `video-delivery-qa`
- `media-rights-research`

花型设计伙伴使用：

- `pattern-generate`
- `canvas-compose`
- `pattern-seam-review`
- `lovart-api`

课程研发伙伴使用：

- `course-researcher`
- `course-architect`
- `course-builder`
- `course-lab-builder`
- `course-practice-builder`
- `course-ppt`

## 4. 初始化流程

`bootstrap-marketplace` 以组织、发布者、审核者、默认模型资源和运行镜像作为输入。
流程如下：

1. 加载 Worker definition catalog，并校验 `catalog.json` 中每个定义的 bundle hash。
2. 打包并 upsert 平台级 Skills。
3. 为每个内置伙伴生成 WorkerSpec 快照和依赖 artifact。
4. 创建或校验组织内伙伴。
5. 提交市场发布申请。
6. 自动审核通过 operator-owned release。

花型设计伙伴需要显式传入 Lovart 凭据包：

```bash
go run ./backend/cmd/server bootstrap-marketplace \
  --organization dev-org \
  --publisher dev@agentcloud.local \
  --reviewer admin@agentcloud.local \
  --model-resource-id 3 \
  --runtime-image-id 4 \
  --lovart-env-bundle-id 1
```

## 5. 密钥与可移植性

组织内伙伴快照允许引用本组织凭据包。例如花型设计伙伴的本地 WorkerSpec 包含：

- `LOVART_ACCESS_KEY -> env-bundle:1`
- `LOVART_SECRET_KEY -> env-bundle:1`

市场发布快照必须剥离这些引用：

- `type_config.secret_refs` 发布为 `{}`。
- `workspace.env_bundle_ids` 发布为 `[]`。
- `workspace.config_bundle_ids` 发布为 `[]`。
- 仓库和知识库引用不能进入发布快照。

安装市场伙伴时，目标组织再按 Worker definition 的 required credential bundle
合同自动选择有效凭据包。选择规则：

1. 凭据包必须 active。
2. `kind` 必须是 `credential`。
3. 名称必须匹配 Worker definition 的 `credential_bundle.ref`。
4. owner scope 必须对目标用户和组织可见。
5. `agent_slug` 为空或等于目标 Worker 类型。
6. 多个同分候选视为歧义，必须报错。

## 6. 图标合同

市场应用图标是前后端共同合同。当前支持：

- `rocket`
- `network`
- `git-compare`
- `clapperboard`
- `scissors`
- `film`
- `palette`
- `graduation-cap`

新增图标必须同时更新后端校验、前端类型、前端 icon 映射和组件测试。

## 7. 验收

数据库验收：

- `experts` 中包含 6 个伙伴。
- 用户可见 `name` 不包含“专家”。
- 5 个内置市场应用都有 published release。
- 平台 Skills 总数为 17。
- WorkerSpec 快照总数为 5。
- 市场 release 的 `type_config.secret_refs` 为空对象。
- 花型设计伙伴源快照绑定 Lovart env bundle。

浏览器验收：

- `/{org}/experts` 能看到交付质量、视频、花型设计、课程研发伙伴。
- `/{org}/experts/pattern-design-partner` 能打开花型设计伙伴档案。
- `/{org}/experts/course-development-partner` 能打开课程研发伙伴档案。
- 市场页显示 5 个内置伙伴，且花型与课程图标正常渲染。
- 控制台和关键网络请求无错误。

## 8. 修订记录

- 2026-07-25：恢复视频伙伴，新增花型设计伙伴和课程研发伙伴；补齐市场 icon
  合同；明确发布快照剥离密钥、安装侧重新绑定凭据的规则。
