---
name: course-builder
description: 课程任务、课件正文与 Markdown 学习文件研发。用于在课程大纲或章节计划已确认后，逐章、逐任务把参考资料、代码案例和实验资源研发成可教、可学、可练、可验收的课程内容，并通过 bundled CLI 生成、校验机器可读课程包。需要实验 runbook 时衔接 course-lab-builder，需要题库/quiz 时衔接 course-practice-builder，不负责整课架构；平台发布只允许在教师明确请求且提供当前教师凭据时由 CLI 执行并回读。
---

# Course Builder

把已确认的课程结构落成真实可教学内容。核心任务不是“生成页面”，而是把参考资料研发成学生能读、能做、能交证据的 Markdown 学习文件。

## 什么时候使用

- 用户要求“构建课程任务”“逐章填充”“先做第 X 章”“一个任务一个任务来”。
- 用户要求生成课件正文、学习文件、教师讲稿、学生工作纸、提交模板、章节交付单。
- 用户指出课程内容空、只有大纲、没有知识点、没有实操、不能像老师备课。
- 已有课程大纲、章节计划、任务清单或参考资料，需要落成具体教学内容。

## 工作边界

负责：

- 章节备课与任务落地。
- 参考资料消化：source-card、knowledge-card、evidence-card。
- 教学方法落地：三问定位、反向设计、课程对齐、任务中心教学、苏格拉底引导问题、通俗解释和形成性反馈。
- Markdown 学习文件研发。
- 教师讲授脚本、学生工作纸、提交模板、章节交付单；需要课程 PPT 时输出需求并交给 `course-ppt`。
- 技术引用与配图需求：具体到仓库文件/URL/函数/章节/代码行；需要图示时生成配图 prompt、替代文本和图片资产。
- 实验需求单和练习/题库需求单。
- 内容质量审计。

不负责：

- 从零设计整课结构：使用 `course-architect`。
- 写完整实验 runbook：使用 `course-lab-builder`。
- 生成题库题目和 quiz 绑定细目：使用 `course-practice-builder`。
- 生成课程 PPT 和逐页课件：使用 `course-ppt`。
- 默认不执行 Gitea、课程 API、资源绑定和发布；教师明确要求平台建课时，只能使用本 skill 的 `course_package_cli.py publish`，并要求当前教师凭据、精确栏目解析、发布后课程与大纲回读。

## 必须读取的参考文件

按任务读取，不要一次性加载所有文件：

- 生成或重写 Markdown 学习文件：读 `references/markdown-learning-file-standard.md`。
- 做整章备课、章节任务落地：读 `references/lesson-prep-workflow.md`。
- 需要课程设计方法论、通俗讲解、苏格拉底提问、技术引用或配图：读 `references/pedagogy-methodology.md`。
- 用户指出“空洞”“不饱满”“不像老师研发课程”“学生看不懂”“只有文件名/表格/口号”时：读 `references/rich-course-authoring-standard.md`，先做根因评审再重写。
- 从 GitHub、文档、Notebook、代码仓库提炼内容：读 `references/source-digestion-workflow.md`。
- 课程页面需要流程图、架构图、状态图、对比图或概念图：读 `references/visual-asset-workflow.md`。
- 做质量审计或用户质疑“是否合格”：读 `references/content-quality-audit.md`，并运行 `scripts/audit_learning_file.py`。
- 为 teacher-assistant、AgentCloud 或其他自动化入口生成结构化课程：读 `references/course-package-schema.md`，并使用 `scripts/course_package_cli.py` 原子构建和校验 `course-package.json`。
- 教师明确要求发布到平台：先读 `references/platform-publish-contract.md`。缺少明确 API 地址或当前教师凭据时必须停止在 `pending_credentials`，不能声称已建课。
- 产物进入 `courses/<course-key>/course-git`，或需要修改 `course.yaml`、根 `lesson.yaml`、`task.yaml` 时：必须先读 `references/course-git-schema.md`。Course Git schema 只以该 reference 和当前 course-api 实现为准，不从历史课程或已废弃 skill 复制。
- Course Git 任务目录唯一合法位置是 `lessons/<lesson>/tasks/<task>/`。禁止在 `lessons/<lesson>/<task>/` 或其他兄弟路径先生成再复制；如果曾写错路径，必须删除错误副本并确认仓库中每个 `task.yaml` 都位于唯一合法位置。
- 创建产物时，`templates/` 下有对应模板就复用；没有模板时，按本 skill 的产物定义和相关 reference 创建，不得声称每个强制产物都有模板。
- 需要查看合格样例：读 `examples/structured-prompt-learning-file.md`。

## 强制产物链

每个任务必须按这个顺序生成，不允许跳到正文：

1. `source-card`：参考资料来自哪里，具体到文件、章节、函数、Notebook、URL。
2. `knowledge-card`：本任务拆成哪些知识点，每个知识点解决什么问题。
3. `evidence-card`：学生交什么证据，教师如何验收。
4. `pedagogy-card`：为什么学、学什么、怎么做；苏格拉底问题；通俗解释；配图决策。
5. `technical-citation-card`：技术资料引用清单，具体到 URL、路径、函数、章节或代码行。
6. `visual-asset-card`：需要配图时写教学目的、画面 prompt、替代文本、资产路径；不需要时说明原因。
7. `learning-file.md`：学生学习正文。
8. `teaching-script.md`：教师课堂讲授脚本。
9. `student-worksheet.md`：学生课堂/课后工作纸。
10. `submit-template.md`：提交物模板。
11. `lab-requirement.md`：需要实验时输出，交给 `course-lab-builder`。
12. `practice-requirement.md`：需要练习/题库时输出，交给 `course-practice-builder`。
13. `quality-audit.md`：本任务内容质量自查。

如果时间或用户要求只写一个 Markdown 学习文件，也必须在文件开头或相邻文件中保留 source-card、knowledge-card、evidence-card 的信息。

## 逐章工作流

1. 读取课程架构、章节计划和参考资料清单。
2. 用 `lesson-prep-workflow.md` 完成本章备课：学情、目标、证据、知识点图谱、教学顺序。
3. 用 `source-digestion-workflow.md` 消化参考资料，产出本章 source-map。
4. 生成任务清单：每章 3-6 个任务，每个任务有可交付产物。
5. 按任务生成强制产物链。
6. 需要实验时只写实验需求单，不用 markdown 冒充平台实验。
7. 需要练习/题库时只写练习需求单，交给 `course-practice-builder`。
8. 用 `content-quality-audit.md` 审计每个学习文件，并执行 `python3 skills/course-builder/scripts/audit_learning_file.py <learning-file.md>`；脚本返回非零时必须修正后重跑。
9. 同章或批量生成多个学习文件时，把全部文件一次传给 `audit_learning_file.py`；跨文件出现 100 字以上完全重复段落会返回非零，必须按各任务机制重写，不能共享通用苏格拉底问题、示例、练习、排错、rubric 或章节衔接段落。
10. 汇总章节交付单，说明本章产物如何衔接下一章。
11. 如果修改了 Course Git 清单或任务目录，执行 `python3 skills/course-builder/scripts/validate_course_git_schema.py courses/<course-key>/course-git`，返回非零时修正真实 schema 冲突；不得只验证目标文件存在，必须让校验器扫描并拒绝错误路径、孤立副本和第二权威源。
12. 自动化入口必须生成并校验 `artifacts/course-package.json`；只在用户明确要求后用 `course_package_cli.py publish` 进入当前平台发布流程，不调用已废弃的 `course-management`。

批量生成文件时，含中文的临时 Python 脚本必须使用 UTF-8 文件编码并以 UTF-8
读写目标文件。不要把含中文源码通过未声明编码的标准输入交给 Python；此类工具错误会
让 doagent completion review 判定任务未完成。

## Evidence Policy

课程研发以证据质量为准，不以调研次数为准。任何“最多 N 次调研，拿不到结果就结束”的规则都不能作为硬性完成条件。次数、耗时和调用成本只能用于调整策略，不能替代教学判断。

### 证据等级

- `A 级证据`：官方文档、源代码、可运行实验、平台 API 回读、测试结果、Notebook 输出、课程原始素材。
- `B 级证据`：可信技术文章、项目 README、示例仓库、历史课程成品、教师提供的说明。
- `C 级证据`：模型推断、常识性经验、未验证的二手资料、缺上下文的截图或片段。

学习文件的核心机制、操作步骤、实验验收和评分标准必须由 A/B 级证据支撑。C 级证据只能用于提出假设、写待确认项或辅助解释，不能单独支撑结论。

### 证据不足时的决策

当资料缺失、链接失效、搜索无结果、仓库缺文件、实验未跑通或多次补充调研仍无结果时，按证据政策处理：

1. `收窄问题`：把缺口拆到具体对象，如文件、函数、API、配置项、Notebook cell、命令输出、日志、实验项目或验收字段。
2. `更换证据`：优先改用本地仓库、平台 API、官方文档、测试用例、实验运行结果、已有课程素材或用户提供材料。
3. `分层交付`：把已被证据支撑的内容继续完成；把缺证据内容拆成待补项、风险项或资料需求单。
4. `显式标注`：在 source-card、technical-citation-card、learning-file 或 quality-audit 中写清证据缺口、替代依据、可信等级和教学影响。
5. `停止条件`：只有当证据缺口会导致学生无法操作、无法验收、可能学到错误内容、涉及安全/合规/生产风险，或核心结论只能靠猜测时，才暂停该任务正文并请求补资料。

### 允许降级的交付

证据不足但不影响学生完成可验证动作时，可以交付降级版本：

- `证据不足版学习文件`：只讲已确认内容，并保留“待确认证据”和“不要据此操作生产环境”的说明。
- `资料需求单`：列出缺少的文件、链接、接口、实验输出或教师确认点。
- `实验需求单`：把未跑通的环境、输入、预期输出和验收脚本交给 `course-lab-builder`。
- `后续补证清单`：列出补证路径、优先级和补齐后需要重写的段落。

降级交付不能伪装成完整交付。只要核心结论或实验验收缺证据，完成定义中必须标为 `blocked` 或 `partial`。

### 完成判断

是否继续研发，只看三件事：

1. 现有证据能否支撑教学结论。
2. 学生能否完成明确动作并提交可验收证据。
3. 风险和不确定性是否被清楚标注。

如果这三件事成立，继续推进并记录缺口；如果任一项不成立，暂停该任务正文，先补证据或调整任务范围。

## Markdown 学习文件最低标准

一份合格学习文件必须同时具备：

- 具体参考来源：不能只写资料名。
- 真实问题入口：学生知道为什么学、学什么、怎么做。
- 一个主知识点或紧密任务：不能堆百科。
- 方法论支撑：目标、证据、活动对齐；任务围绕真实问题推进。
- 苏格拉底引导：至少 3 个逐步追问，让学生先判断、解释、举证，再给结论。
- 通俗解释：先用学生语言和类比解释，再给工程术语。
- 技术引用：具体到参考资料位置、采用点和可核查证据。
- 配图决策：复杂流程/架构/状态/对比必须有图示；需要图片时生成 prompt 和图片资产。
- 最小示例：Prompt、代码、配置、命令或数据至少一种。
- 过程解释：模型、程序、工具、状态、检索、评估或人工分别做什么。
- 学生动作：读完能改一个东西、跑一条路径、判断一次失败或产出一个文件。
- 提交证据：日志、Trace、JSON、截图、报告、测试结果或评估表。
- 错误排查：至少 3 个常见错误。
- 自检题：至少 3 题，能进入练习或 quiz。
- 章节衔接：说明本页产物如何进入下一任务或下一章。

## 饱满度质量门

当用户要求“像老师研发课程”或指出“空洞”时，最低标准不够，必须执行饱满度质量门：

- 先写学生视角的学习旅程：学生已会什么、为什么现在需要这一步、最可能卡在哪里、本页产物如何进入本章主作品。
- 每页只能承载一个主任务，但要讲透：失败场景、概念解释、反例、最小示例、教师示范、学生练习、提交证据、排查路径必须连成一条线。
- “为什么学”不能是口号，必须有具体失败样例，说明不学会坏在哪里。
- “怎么做”不能只写“设计/实现/完成 + 文件名”，必须给 5-8 个步骤，每步包含操作、预期现象、为什么这样做、失败先查哪里。
- 核心概念不能只列术语。每个概念至少包含：人话解释、本任务例子、工程术语、在 Prompt/代码/日志/报告中的位置、失败现象。
- 示例不能只是文件路径。代码块如果只有 `schemas/x.json`、`outputs/y.md` 这类路径，判为不合格；必须展示文件内容片段、Prompt、JSON、命令、输入输出或 Trace。
- 学生练习必须让学生“改、跑、判、写、交”之一发生，并说明最少样例数量和证据格式。
- 教师讲授脚本不能只给讲授目标，必须含板书结构、逐段讲解话术、即时提问、示范动作、学生误区、反馈话术。
- 学生工作纸不能只给空表，必须给填表示例、输入材料、判断标准和同伴检查方式。
- 需要配图时必须生成图片资产。课程封面、课程插图、用户明确要求 image-gen 时，必须使用 `imagegen` 生成 PNG/JPG/WebP 位图；不能用 SVG/Mermaid 代替。

经验阈值：学生可见学习讲义通常不少于 3000 个中文字符；实操页不少于 1200 个中文字符；提交说明必须包含不通过样例和 rubric。低于阈值不代表一定失败，但必须人工说明为什么仍然足够。

## 禁止输出

- 只有“讲授目标、课堂导入、核心讲解、检查点”的空架子。
- “学生理解/掌握/了解……”作为主要目标。
- “参考资料自行阅读”“教师讲解三个问题”“完成实验并截图”这类泛化话术。
- 没有具体来源、没有示例、没有学生动作、没有验收证据的页面。
- “怎么做：设计/实现/完成某文件”这类没有步骤、没有示范、没有检查的页面。
- 代码块只放文件名或路径，正文没有展示文件内容。
- 用表格堆信息替代讲解，导致学生不知道先做什么、为什么做、失败怎么查。
- 把实验 runbook、题库、评分表当作学习正文。
- 未消化参考资料就批量生成整章内容。
- 多个任务共享同一段苏格拉底问题、核心概念、练习、错误排查、rubric、图示 prompt 或章节衔接，只替换标题和产物名。

## 完成定义

一次 course-builder 交付只有在满足下面条件时才算完成：

- 每个学习文件通过人工质量审计，且 `scripts/audit_learning_file.py` 返回 0。
- 同批学习文件一次性通过 `scripts/audit_learning_file.py <file...>`，不存在跨文件长段落重复。
- 每个任务都有 source-card、knowledge-card、evidence-card。
- 每个任务都有 pedagogy-card、technical-citation-card；需要图示时有 visual-asset-card 和图片资产。
- 每个任务都回答：学什么、为什么学、怎么做、交什么、怎么验。
- 实验需求能交给 `course-lab-builder` 继续落地。
- 练习需求能交给 `course-practice-builder` 生成题库/quiz。
- 章节交付单能说明本章与前后章节的逻辑关系。
- Course Git 清单遵守 `course.yaml -> 根 lesson.yaml -> task.yaml -> 资源文件` 的唯一权威链，且 schema 校验器返回 0。
- 自动化建课场景的 `course-package.json` 通过 `course_package_cli.py validate`；如请求发布，CLI 回读的 course id、`published_commit` 和 lesson/task 数量与课程包一致。
