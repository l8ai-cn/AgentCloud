---
name: course-lab-builder
description: 课程实验与实操 runbook 构建。用于把课程任务中的实验需求落成可执行实验，包括实验类型选择、环境准备、操作步骤、输入输出、证据采集、失败排查、验收标准和实验资源绑定建议；不负责整课大纲、普通课件正文、题库练习或平台发布。
---

# Course Lab Builder

把课程中的“动手做”变成真正能执行、能复现、能验收的实验。

## 触发条件

- 用户问“实操练习用什么实验类型”“实验怎么设计”“实验不是 markdown 吗”。
- 课程任务中存在 `lab`、实验、项目实训、容器环境、本地运行、工具调用、MCP 调试等内容。
- 需要把实验说明和平台实验资源绑定分开设计。

## 实验类型

优先按任务目标选择实验类型：

- PhET 仿真实验：适合物理、化学、数学、量子、比例、复利等需要可视化变量操控和即时反馈的概念模型。转交 `course-phet`。
- Jupyter Notebook 实验：适合数据分析、模型训练、数值计算、仿真计算、逐单元教学演示。转交 `course-jupyter-notebook`。
- SDT 卫星仿真实验：适合链路预算、雨衰、选站、过境窗口、Cesium 可视化等卫星教学实验。转交 `course-sdt-edu-simulation`。
- 容器实验：适合固定依赖、命令行、服务启动、日志观察。
- 本地环境实验：适合本地应用运行、配置调试、仓库实践。
- 工具调用实验：适合 Tool、Skill、MCP、Gateway、Workflow 调用验证。
- 案例分析实验：适合 Trace、报告、失败复盘、安全审查。
- 综合项目实验：适合多步骤交付、端到端 Agent 或 Harness 验证。

## Skill 路由规则

`course-lab-builder` 是实验入口和 runbook 兜底，不要抢专门 Skill 的职责：

| 实验需求 | 使用 Skill | 交付重点 |
| --- | --- | --- |
| 设计/开发 PhET 风格可交互仿真 | `course-phet` | runnable 仿真、变量控制、即时反馈、多语言、浏览器验证 |
| 创建 `.ipynb` 或 notebook 子任务 | `course-jupyter-notebook` | 可运行 notebook、单元结构、输出证据、平台 notebook 绑定建议 |
| 卫星/SDT 教学仿真 | `course-sdt-edu-simulation` | `sdt_edu` Simulation 代码、Notebook 或教学 demo |
| 题库、quiz、练习测评 | `course-practice-builder` | 题目、答案、解析、知识点映射、quiz 方案 |
| 普通容器/WebIDE/工具调用/案例实验 | `course-lab-builder` | runbook、环境、步骤、证据、验收、故障排查 |

MAIC 互动课件不是实验类型。用户要“课件、课堂展示、互动讲解、语音图文富媒体、classroom JSON”时，使用 `course-maic-builder`；不要把 MAIC 当作 lab runbook。

如果一个实验同时包含多种形态，先拆分交付物：例如“PhET 仿真 + 课后题”应由 `course-phet` 负责仿真，`course-practice-builder` 负责题库；不要把学生提交证据、quiz 或课程评价塞进 PhET 仿真本体。

## 构建流程

1. 读取任务目标和实验需求单。
2. 判断实验类型，并说明为什么采用该类型。
3. 写实验目标、前置条件、环境、目录、账号、密钥和数据要求。
4. 写至少 5 个可执行步骤，每步包含输入、操作、预期输出。
5. 写证据采集要求：截图、日志、Trace、报告、配置片段、脱敏方式。
6. 写失败排查：常见错误、定位命令、重跑策略、回滚方式。
7. 写验收标准：通过、不通过、需修改的客观判断。
8. 写入 Course Git 前读取 `../course-builder/references/course-git-schema.md`。平台实验子任务按渲染形态使用 `lab`、`experiment` 或 `notebook`，并显式配置 `lab_task_id`；通用实验优先用 `lab`，`experiment_id` 只是历史字段，不能作为实验启动绑定。
9. 修改清单后执行 `python3 skills/course-builder/scripts/validate_course_git_schema.py courses/<course-key>/course-git`。如果需要平台发布或绑定，只输出所需字段和验证点，不调用已废弃的 `course-management`。

## 质量门

- 实验子任务必须保持平台实验类型 `lab`、`experiment` 或 `notebook`，不能用 markdown 冒充实验。
- 实验说明 markdown 只承载说明、runbook 和提交要求。
- 实验标题必须面向学生学习目标，表达“做什么/学什么/产出什么”，例如“用万悟搭建课程问答智能体”；禁止使用只描述平台容器、嵌入方式或运行状态的标题，例如“嵌入万悟平台”“智能体实验：Running”“实验环境入口”。
- 每个实验必须有清晰产物：可运行结果、截图、日志、Trace、报告或仓库提交。
- 不允许只写“运行项目并截图”“完成实验”“观察结果”。
- 涉及密钥、账号、用户数据、内部路径时必须写脱敏规则。

## 交付物

- 实验说明 markdown
- 实验资源绑定建议
- 学生提交清单
- 验收 rubric
- 常见故障清单

## 平台实验项目维护 CLI

实验项目的增删查验必须走平台 HTTP API，不直连 Mongo/Redis，不用浏览器 cookie 当自动化凭据。

当前 skill 提供轻量 Lab 项目维护入口：

```bash
python skills/course-lab-builder/scripts/lab_project_cli.py project-delete <project_id>
```

认证统一使用一个平台 Token，读取顺序：

- `--api-key`
- `ZHIYONG_PLATFORM_API_KEY`

本地联调默认网关是 `http://127.0.0.1:28071`，线上可显式传：

```bash
python skills/course-lab-builder/scripts/lab_project_cli.py \
  --base-url https://hdu.aiedulab.cn \
  project-get <project_id>
```

删除命令会先 `GET /api/lab/projects/{id}` 确认对象，再 `DELETE /api/lab/projects/{id}`，最后再次 `GET` 复查项目已不存在。
