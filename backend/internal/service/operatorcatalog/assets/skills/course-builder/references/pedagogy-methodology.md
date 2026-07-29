# 课程设计方法论与学习文件写作规范

用于把课程研发从“资料摘要”提升为“有方法论支撑的教学设计”。写课程时按需读取，不要把本文件整段搬到学生页面。

## 1. 方法论底座

| 方法 | 课程研发中怎么用 | 质量检查问题 |
| --- | --- | --- |
| Backward Design | 先定学生最终能做什么，再定证据，最后安排讲解和练习。 | 这页的提交物能证明学习目标吗？ |
| Constructive Alignment | 目标、学习活动、练习、测验、提交物必须对应同一能力。 | 是否存在讲了但不练、练了但不考、考了但没教？ |
| Merrill 首要教学原理 | 围绕真实任务：激活旧知、示范、应用、整合迁移。 | 学生是否在解决一个真实任务，而不是背术语？ |
| Bloom 修订分类 | 目标用可观察动词：识别、解释、改写、运行、验证、评估。 | 是否仍在用“理解/掌握/了解”冒充目标？ |
| Socratic Questioning | 先用问题推动学生发现边界，再给术语和结论。 | 这页是否有 3 个以上递进追问？ |
| Plain Language | 先说人话，再引入术语；术语首次出现必须配通俗解释。 | 本科/专科学生是否第一遍能读懂要做什么？ |
| UDL | 用多种表达方式：文字、表格、图、示例、操作、反思。 | 是否给了不同基础学生进入任务的入口？ |
| Mayer 多媒体原则 | 图只服务学习目标，去掉无关装饰，文字和图要相互补充。 | 这张图是否减少理解成本，而不是增加噪音？ |

参考来源：

- MIT Teaching + Learning Lab, Backward Design: https://tll.mit.edu/teaching-resources/course-design/backward-design/
- University of Illinois CITL, Course Alignment: https://citl.illinois.edu/course-alignment
- Merrill, First Principles of Instruction: https://web.mit.edu/ruggles/articles/first-principles-of-instruction-merrill-educational-technology-research-and-development-2002.pdf
- USC STEM Education Research Group, Socratic Questioning: https://stem-ed.usc.edu/our-research/eerp/socratic-questioning/
- UK Department for Education, Plain Language: https://design.education.gov.uk/content-design/plain-language
- CAST, Universal Design for Learning: https://www.cast.org/what-we-do/universal-design-for-learning/
- Mayer multimedia learning summary: https://instructionaldesign.io/toolkit/mayer/
- UIC Bloom’s Taxonomy guide: https://teaching.uic.edu/cate-teaching-guides/syllabus-course-design/blooms-taxonomy-of-educational-objectives/

## 2. 每个学习文件必须回答的三问

学生页面开头必须让学生知道：

| 问题 | 写作要求 |
| --- | --- |
| 为什么学 | 给一个真实失败、真实需求或真实项目场景。 |
| 学什么 | 只列本页必须学的 1 个主能力和 2-4 个支撑知识点。 |
| 怎么做 | 写清本页操作路径、产物文件和验收证据。 |

坏例子：

- 本节学习 LangGraph 的基本概念。

好例子：

- 你已经能让模型回答问题，但它失败后不知道从哪一步恢复。本节要把问答流程画成状态图，并实现“检索失败后改写问题再检索”的分支。提交 `graph.py`、两条执行 Trace 和一张状态图。

## 3. 苏格拉底提问模板

每页至少设计 3-5 个递进问题，放在“苏格拉底引导问题”或教师脚本中。

| 层次 | 提问目的 | 示例 |
| --- | --- | --- |
| 观察 | 让学生看见现象 | 这两次输出哪里不一样？ |
| 解释 | 让学生说出原因 | 为什么程序无法稳定读取第二次输出？ |
| 证据 | 让学生拿证据说话 | 哪一行日志能证明问题出在格式，而不是模型能力？ |
| 边界 | 让学生知道何时不用 | 这个任务一定需要 Agent 吗？直接调用模型够不够？ |
| 迁移 | 让学生连接后续 | 如果下一章要封装成 Chain，这个产物会被放在哪里？ |

禁忌：

- 不要连问十几个泛泛问题。
- 不要用问题代替讲解；学生回答后必须给出清晰归纳。
- 不要只问“你理解了吗”“有什么想法”。

## 4. 通俗讲解规范

技术概念首次出现时必须按“四层解释”写：

1. 学生语言：一句不带术语的话。
2. 小例子：与本章主产物直接相关。
3. 工程术语：给出英文名或框架名。
4. 失败现象：这个概念没做好会坏在哪里。

示例：

```markdown
固定栏目就是先规定学习卡片必须有哪些格子。比如每张卡都要有标题、关键词、解释、例子和练习。工程里这常叫 schema；如果 schema 没写清，AI 可能多写或漏写栏目，程序就没法检查。
```

## 5. 技术引用规范

学习文件不能只写“参考某课程”。技术引用至少包含：

| 字段 | 要求 |
| --- | --- |
| 来源 | 仓库、文档、论文、官方教程或课程名称。 |
| 位置 | URL、文件路径、章节标题、函数名、Notebook 单元、代码行或 commit。 |
| 本页采用点 | 概念、代码、参数、流程、图、失败案例或实验数据。 |
| 学生如何核查 | 学生能去哪里看到原始依据，或在代码里如何验证。 |

如果引用 GitHub 代码，优先写成：

```markdown
| hello-agents | `docs/chapter3/第三章 大语言模型基础.md` | system/user message 与 token 边界 | 对照本页 Prompt 的“固定规则/本次主题”两部分 |
```

如果引用框架 API，写清版本或文档日期；不确定最新版时必须先查官方文档。

## 6. 配图决策

以下内容通常需要图：

- Agent 执行循环、状态图、条件路由、多 Agent 通信。
- LangChain/LangGraph 组件关系。
- RAG 检索、重排、生成、引用检查流程。
- 普通 Agent 与 Agentic Workflow 的对比。
- 实验目录结构、运行链路、错误排查路径。

以下内容通常不需要图：

- 简单定义。
- 单个命令。
- 已经由短表格表达清楚的对比。

需要图时必须生成：

- 图片教学目的。
- 图片类型：流程图、架构图、状态图、对比图、概念图、实验步骤图。
- 生成 prompt。
- 图片文件路径。
- alt 文本。
- 学生页中的引用位置。

生成图时优先简洁、清晰、文字少；不要做装饰性海报。
