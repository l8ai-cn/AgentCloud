# Graph Relation Policy

The learning companion graph is a learning map. It should help a student navigate what to learn, what depends on what, what they misunderstood, and what evidence supports each claim.

Node IDs:

- For `subject`, build stable IDs from the subject label.
- For `unit`, build stable IDs from subject and unit labels.
- For `knowledge_point`, build stable IDs from subject, unit, and normalized knowledge-point label.
- For `evidence`, prefer explicit `resourceId`; fall back to `eventId` when no resource identity exists.

Node layers:

- `subject`: domain/course-scale area.
- `unit`: topic/chapter/problem family.
- `knowledge_point`: concrete concept, method, misconception, application, or assessment target.
- `evidence`: source note, wiki page, exercise, answer, mistake, review, or session record.

Knowledge-point labels:

- A good label names what the student should explain, apply, distinguish, or practice.
- Prefer actionably specific labels such as `softmax 归一化在注意力机制中的作用`, `变量作用域与生命周期`, `凸透镜成像性质判断`, `波函数归一化条件`.
- Template dimensions such as `概念框架`, `核心原理`, `实验与验证`, `应用迁移`, `典型问题`, `常见误区`, `复习卡`, and `练习` are not labels. Use them as `templateDimension`, `evidence.kind`, or tags.
- If only a title exists and it is `学科-主题-模板维度`, create a temporary point `主题 - 模板维度` with `needsDecomposition: true`; replace it with body-derived knowledge points once content is available.

Relation types:

- `contains`
- `prerequisite`
- `explains`
- `applies_to`
- `contrasts_with`
- `misconception_of`
- `assessed_by`
- `remediates`

Relation rules:

- Use `contains` for hierarchy only.
- Use `prerequisite` only when a learner likely fails B without A.
- Use `explains` for mechanism, definition, reason, law, proof, or model-to-effect links.
- Use `applies_to` for method-to-scenario, concept-to-task, or algorithm-to-problem links.
- Use `contrasts_with` for confusable or competing concepts.
- Use `misconception_of` from misconception node to target knowledge point.
- Use `assessed_by` from knowledge point to question/practice/evidence.
- Use `remediates` from review/practice/correction evidence to weak knowledge point.
