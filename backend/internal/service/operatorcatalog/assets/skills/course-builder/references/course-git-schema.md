# Course Git Schema

本文定义当前课程平台实际读取和写入的 Git 课程结构。它是所有 `course-*` skills
写入课程仓库时的唯一 schema 参考。

## 目录

- [唯一权威链](#唯一权威链)
- [目录结构](#目录结构)
- [course.yaml](#courseyaml)
- [根 lesson.yaml](#根-lessonyaml)
- [task.yaml](#taskyaml)
- [子任务资源契约](#子任务资源契约)
- [校验](#校验)

## 唯一权威链

Git 课程只允许以下权威链：

1. `course.yaml`：课程元数据和题库引用。
2. 仓库根 `lesson.yaml`：课时、任务和子任务的快速导航索引。
3. `<task-path>/task.yaml`：任务及其完整子任务定义。
4. `task.yaml` 引用的 Markdown、JSON、实验清单、文档和其他资源文件。

禁止建立第二数据源：

- 不在 `course.yaml` 内写 `lessons`。
- 不创建或维护 `lessons/<lesson>/lesson.yaml`。
- 不根据目录编号推断 lesson、task 或 subtask ID；ID 以 YAML 字段为准。
- 不让根 `lesson.yaml` 和 `task.yaml` 保存两份不同的导航元数据。

## 目录结构

```text
course-git/
├── course.yaml
├── lesson.yaml
├── question-banks/
│   └── <bank>.yaml
└── lessons/
    └── <lesson>/
        └── tasks/
            └── <task>/
                ├── task.yaml
                └── subtasks/
                    ├── <content>.md
                    ├── <quiz>.quiz.json
                    ├── <lab>.lab.yaml
                    └── <document>
```

所有路径必须是仓库内的相对 POSIX 路径，禁止绝对路径和 `..`。

任务目录必须且只能位于 `lessons/<lesson>/tasks/<task>/`。如果生成过程中出现
`lessons/<lesson>/<task>/task.yaml`、其他层级的 `task.yaml`，或把正确内容复制到
`tasks/` 后仍保留原目录，这些文件都是孤立的第二副本，必须删除；根索引没有引用它们
也不能视为无害。

## course.yaml

```yaml
id: ai-trainer
title: AI 训练师
name: AI 训练师
description: 课程说明
cover_url: assets/cover.png
type: practice
column_id: ai
status: 1
sort: 10
default_language: zh-CN
tags:
  - 人工智能
question_bank_id: ai-trainer-default
question_banks:
  - id: ai-trainer-default
    name: 默认题库
    path: question-banks/default.yaml
```

必填字段：

- `title`
- `type`
- `column_id`
- `status`
- `sort`

规则：

- `id` 可选；需要仓库内稳定的人类可读标识时可以填写，但平台课程 ID 仍来自课程记录。
- 封面使用 `cover_url`；仓库资源路径由 parser 转换为课程资源 URL。
- `sort` 必须是整数。
- `tags` 必须是字符串数组。
- `question_bank_id` 如果存在，必须引用 `question_banks[].id`。
- `question_banks[].id` 必须存在且在课程内唯一。
- 题库引用可使用 `platform_bank_id`、`source_platform_bank_id`、`name`、
  `answer_sheet_type`、`type_codes`、`type`、`kind`、`path`、`description`。
- 多语言课程使用分支承载不同语言版本；不要新增 `supported_languages` 作为运行时
  schema。

## 根 lesson.yaml

```yaml
lessons:
  - id: lesson-01
    title: 第一课
    status: 1
    sort: 1
    path: lessons/lesson-01
    tasks:
      - id: task-01
        title: 认识模型
        type: lesson
        duration: 30
        status: 1
        sort: 1
        path: lessons/lesson-01/tasks/task-01
        subtasks:
          - id: subtask-01
            title: 模型是什么
            category: study
            type: markdown
            duration: 10
            completed: false
            status: 1
            sort: 1
            metadata: {}
```

lesson 必填字段：

- `id`
- `title`
- `status`
- `sort`
- `path`
- `tasks`

task 索引必填字段：

- `id`
- `title`
- `status`
- `sort`
- `path`
- `subtasks`

根索引中的 `subtasks` 只保存导航元数据，并必须与对应 `task.yaml` 的同名字段一致：

- `id`
- `title`
- `category`
- `type`
- `duration`
- `completed`
- `status`
- `sort`
- `metadata`

完整内容和资源字段不写入根索引。

## task.yaml

```yaml
id: task-01
title: 认识模型
type: lesson
duration: 30
status: 1
sort: 1
subtasks:
  - id: subtask-01
    title: 模型是什么
    category: study
    type: markdown
    duration: 10
    completed: false
    status: 1
    sort: 1
    file: subtasks/model-basics.md
    metadata: {}
```

task 必填字段：

- `id`
- `title`
- `status`
- `sort`
- `subtasks`

subtask 必填字段：

- `id`
- `title`
- `type`
- `status`
- `sort`

通用可选字段：

- task：`name`、`content`、`type`、`duration`、`unlock_type`、
  `unlock_condition`
- subtask：`category`、`duration`、`completed`、`metadata`

`assistantPrompt`、`start_time` 和 `end_time` 不属于当前 Git 解析契约，不要写入新内容。
`code_maieutic` 已被运行时拒绝；代码练习使用 `code_practice`。

## 子任务资源契约

### Markdown

```yaml
type: markdown
file: subtasks/lesson.md
```

使用仓库内 `.md` 文件或内联 `md`。优先使用文件，正文不要在多个位置重复。

运行时读取后的 DTO 投影是唯一且固定的：

- `task.yaml.subtasks[].file` 指向的 Markdown 正文进入
  `lesson.tasks[].subtasks[].source.md`。
- 内联 `task.yaml.subtasks[].md` 同样进入 `subtasks[].source.md`。
- `task.content` 只表示任务级可选说明，不承载 Markdown 子任务正文；不得用
  `task.content` 是否为空判断学习文件是否加载成功。
- 根 `lesson.yaml` 的 `subtasks` 仍只保存导航元数据，不写 `file`、`md` 或运行时
  `source`。

### Quiz

Quiz 必须只有一个题目权威源：

```yaml
type: quiz
file: subtasks/check.quiz.json
```

或：

```yaml
type: quiz
metadata:
  questionIds:
    - "10001"
```

也可使用 `metadata.questionGroups` 或内联 `question_json`。parser 从题目 JSON 派生出的
同值 metadata 镜像是合法的；`.quiz.json`、`question_json` 和 metadata 中的题目 ID
如果同时存在，内容必须一致。

### Lab

```yaml
type: lab
lab_task_id: "12345"
file: subtasks/model.lab.yaml
```

实验入口可按前端渲染形态使用 `lab`、`experiment` 或 `notebook`，并在 subtask、
`.lab.yaml` 或 `.lab.yml` 中显式提供 `lab_task_id`。通用实验优先使用 `lab`；
Notebook 教学资源可使用 `notebook`。`experiment_id` 是历史读取字段，不能启动当前
LabTask，也不能作为新内容的绑定方式。

### MAIC

```yaml
type: maic
iframe_src: https://maic.aiedulab.cn/classroom/<id>?embed=1&primary=0ea5e9
```

新内容使用 `iframe_src`。`classroom_id` 只是历史读取字段，当前 API 写回不会保留仅有的
`classroom_id`，不得继续生成该旧结构。

### 文档和附件

```yaml
type: document
file: resources/guide.pdf
```

也可使用 `url`，或在 `metadata.object_key` 中引用课程对象存储资源。
`metadata.object_key` 存在时由平台生成代理 URL，并覆盖 `file` 的读取来源。

## 校验

任何 skill 新建或修改 Course Git 清单后必须执行：

```bash
python3 skills/course-builder/scripts/validate_course_git_schema.py \
  courses/<course-key>/course-git
```

校验器返回非零表示权威链、路径、引用或字段契约仍有冲突，必须修正真实数据后再交付，
不能用兼容字段或忽略错误绕过。

最小合法样例位于 `../examples/course-git-schema-minimal/`，可用于核对字段落位和校验器
正向结果；业务课程不得直接复用样例 ID。

本规范于 2026-07-26 对照以下事实源校准：

- `zhiyong-course-api/app/service/course_provider/gitea_parser.py`
- `zhiyong-course-api/app/service/course_git_write_service.py`
- `zhiyong-course-api/app/schema/course.py`
- `courses/ai-trainer/course-git`

`ai-trainer` 仓库用于暴露历史漂移，不是可以直接复制的 schema 模板。
