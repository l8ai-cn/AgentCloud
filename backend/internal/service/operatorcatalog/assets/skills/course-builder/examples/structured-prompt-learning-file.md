# 设计结构化 Prompt：让模型输出能被程序检查

## 本页学完你要能做什么

- 能识别自由问答 Prompt 为什么不能直接作为工程接口。
- 能把学习主题生成任务拆成角色、输入、输出 schema、约束和失败处理。
- 能编写一个最小 JSON 检查函数，判断模型输出是否可被程序消费。
- 能提交 3 条运行记录，并说明其中 1 条失败记录如何修正。

## 为什么要学：一个真实失败场景

你要做一个“学习卡片生成器”。学生输入主题，例如“ReAct Agent”，系统返回学习卡片。第一版 Prompt 只有一句：

```text
请帮我生成一张关于 ReAct Agent 的学习卡片。
```

模型可能返回一段自然语言，也可能返回项目符号列表。人能读，但程序不知道标题、关键词、难度、练习题分别在哪里。后续如果要把结果保存到数据库、进入评估集或生成 quiz，这种输出就会失败。

所以本页要解决的问题是：把 Prompt 写成工程接口，让模型输出稳定、可解析、可检查。

为什么学：没有稳定输出契约，模型结果就不能可靠进入数据库、评估集、quiz 或自动化工作流。

学什么：结构化 Prompt 的消息边界、输出 schema、约束和程序检查。

怎么做：先观察自由问答输出的失败，再定义 JSON schema，加入枚举与数量约束，最后用检查函数验证并根据错误原因修正。

## 苏格拉底引导问题

1. 观察：自由问答的三次输出中，哪些字段或结构发生了变化？
2. 解释：为什么“人能读懂”不能证明程序可以稳定消费？
3. 证据：你会用哪条检查结果证明 schema 约束真的生效？
4. 边界：即使输出是合法 JSON，哪些业务错误仍需要程序检查？
5. 迁移：如果输出要进入 quiz 或评估集，当前 schema 还缺什么字段？

## 参考资料怎么用在这里

| 来源 | 位置 | 本页采用什么 |
| --- | --- | --- |
| LLM Cookbook | `docs/C2/7. 检查结果 Check Outputs.md` | 输出检查和一致性校验思路 |
| LLM Cookbook | `docs/C3/2. 模型、提示和解析器 Models, Prompts and Output Parsers.md` | PromptTemplate 与 Output Parser 的衔接方式 |
| Hello-Agents | `docs/chapter3/第三章 大语言模型基础.md` | Prompt、模型幻觉和上下文窗口边界 |

## 核心概念：用任务语言解释

| 概念 | 在任务中的作用 | 可观察证据 | 常见失败 |
| --- | --- | --- | --- |
| Chat Message | 把系统规则、用户输入和工具结果分开放置 | 日志里有 system/user/assistant 角色 | 把所有要求塞进 user，导致约束容易丢 |
| 输出 schema | 规定学习卡片必须有哪些字段 | 输出 JSON 字段完整 | 字段名变化、缺字段、类型不对 |
| 输出检查 | 程序判断模型结果能否进入下一步 | `valid: true/false` 检查结果 | 只看起来像 JSON，但无法解析 |

## 图示与配图

本页不需要配图。核心学习证据来自 Prompt、JSON 输出和检查函数的前后对比，额外示意图会重复代码与表格已经表达的结构关系。

## 最小可运行示例

Prompt 模板：

```text
你是课程助教。请根据用户给定主题生成一张学习卡片。

输入主题：
{topic}

输出必须是 JSON，不要输出 Markdown，不要添加解释。
schema:
{
  "title": "string",
  "keywords": ["string", "string", "string"],
  "difficulty": "beginner|intermediate|advanced",
  "summary": "string",
  "practice": "string"
}

约束：
- keywords 必须正好 3 个。
- difficulty 只能从三个枚举值中选择。
- practice 必须是学生能在 10 分钟内完成的小任务。
```

检查函数：

```python
import json

def check_card(raw: str) -> tuple[bool, str]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        return False, f"not json: {exc}"

    required = ["title", "keywords", "difficulty", "summary", "practice"]
    missing = [key for key in required if key not in data]
    if missing:
        return False, f"missing fields: {missing}"

    if len(data["keywords"]) != 3:
        return False, "keywords must contain exactly 3 items"

    if data["difficulty"] not in {"beginner", "intermediate", "advanced"}:
        return False, "invalid difficulty"

    return True, "ok"
```

## 教师示范：一步一步拆解

| 步骤 | 操作 | 预期现象 | 为什么这样做 | 失败先查哪里 |
| --- | --- | --- | --- | --- |
| 1 | 运行自由问答 Prompt | 输出像文章，不稳定 | 先让学生看见失败 | 看是否有字段边界 |
| 2 | 加入 JSON schema | 输出开始有固定字段 | schema 让程序知道取什么 | 看字段名是否固定 |
| 3 | 加入枚举和数量约束 | `difficulty` 和 `keywords` 更稳定 | 约束减少后续判断成本 | 看类型和数量 |
| 4 | 运行 `check_card` | 得到 `true/false` 和原因 | 程序检查比肉眼可靠 | 看 JSON 解析错误 |

## 学生练习：改一个地方并提交证据

把 schema 增加一个字段：

```json
"common_mistake": "string"
```

要求：

- 修改 Prompt。
- 修改 `check_card`，检查 `common_mistake` 是否存在。
- 分别用 3 个主题运行：`ReAct Agent`、`Output Parser`、`RAG 检索`。
- 提交 3 条输出和检查结果。

## 常见错误与排查

| 现象 | 可能原因 | 排查方法 | 修复动作 |
| --- | --- | --- | --- |
| JSON 解析失败 | 模型输出了 Markdown 代码围栏或解释文字 | 打印原始输出第一行 | 在 Prompt 中强调只输出 JSON |
| 缺少字段 | schema 不够醒目或约束太多 | 对比输出字段和 required 列表 | 把 required 字段单独列出 |
| difficulty 乱写 | 没有限制枚举值 | 检查 `difficulty` 原始值 | 加入枚举和失败重试 |

## 提交物与验收

| 文件 | 内容 | 验收标准 |
| --- | --- | --- |
| `prompt_v1.md` | 自由问答 Prompt | 能说明为什么不稳定 |
| `prompt_v2.md` | 结构化 Prompt | 包含 schema、约束、失败处理 |
| `runs.jsonl` | 3 条主题输入、模型输出、检查结果 | 每条都有 `valid` 和 `reason` |
| `check_report.md` | 失败样例和修复说明 | 至少解释 1 个失败原因 |

## 自检题

1. 概念边界：为什么 JSON schema 不能完全替代程序检查？
2. 操作判断：如果输出字段完整但 `keywords` 有 5 个，检查函数应该返回什么？
3. 失败排查：模型输出 ```json 代码围栏导致解析失败时，先改 Prompt 还是先改 parser？说明理由。

## 和下一节的关系

本页生成的结构化 Prompt 和 `check_card` 会在下一节封装进 LangChain Output Parser。后续学习 Chain 时，不会重新设计学习卡片 schema，而是复用这里的 JSON 结构作为链路输入输出契约。
