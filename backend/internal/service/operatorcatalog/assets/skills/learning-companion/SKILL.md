# Learning Companion

Use this skill to maintain one student's durable learning workspace: wiki pages, a
layered knowledge graph, mastery state, growth evidence, and memory.

## Invocation Boundary

This skill is a persistence tool, not the student's chat tutor.

Use it only for durable intents: `ingest_knowledge`, `learn`, `recommend_learning_path`,
`practice_session`, `practice_submit`, `rebuild`.

Do not use it for conversational intents such as `probe_weakness`, `query`, or
"ask me one question first". If loaded for a conversational intent, ask exactly one
diagnostic question, withhold the answer, and stop without touching workspace state.

## Workspace Contract

The current working directory is the workspace root. All tool paths must be relative.
Keep durable state under:

```text
wiki/index.md
wiki/log.md
wiki/pages/notes/<note-id>.md
wiki/pages/learning-skills/<skill-id>.md
wiki/pages/learning-plans/<plan-id>.md
wiki/pages/practice-sessions/<session-id>.md
wiki/pages/practice-results/<attempt-id>.md
wiki/pages/graph/course_graph.md
wiki/pages/graph/student_overlay.md
wiki/pages/evaluation/metrics.md
wiki/pages/memory/tree.md
wiki/pages/memory/profile.md
wiki/pages/memory/reflections.md
raw/student-events/
```

Never merge students. Never write placeholder or demo data. Never report success
unless the files were actually written and read back.

Read an existing page before updating it and use an edit operation; a blind overwrite
of overlay, metrics, memory, graph, or practice-result pages is a failed turn.

## Evidence-First Write Order

1. Decide the full L3 id registry before writing any file.
2. Write every supporting `wiki/pages/notes/` page first, each carrying `linkedNodeIds`.
3. Then write `course_graph.md`, `student_overlay.md`, and `metrics.md`.
4. Every L3 node needs at least one note whose `linkedNodeIds` contains that exact id.
5. Read back every required page and every referenced note path before reporting success.

Reuse L3 ids verbatim across files. Never rename, translate, shorten, or regenerate one.
An id absent from `course_graph.md` must not appear anywhere else.

## Layered Graph Model

- `L1 subject` — id prefix `subject:`, broad domain found in the student's material.
- `L2 unit` — id prefix `unit:`, coherent topic, chapter, or method family.
- `L3 knowledge_point` — id prefix `kp:`, a concrete point the student can explain,
  apply, distinguish, practice, or review.
- `L4 evidence` — notes and records, linked to L3 ids via `linkedNodeIds`.

Store L1/L2/L3 together in the `nodes` array of `course_graph.md`. Never write L1 as
`graph.subject` or L2 as `graph.units`. Every L3 node must carry `subjectId` + `unitId`
or be reachable by `contains` edges.

Allowed node types: `subject`, `unit`, `concept`, `procedure`, `application`,
`misconception`, `assessment_point`. `knowledge_point` is a layer name, not a type.

Allowed edge types: `contains`, `prerequisite`, `explains`, `applies_to`,
`contrasts_with`, `misconception_of`, `assessed_by`, `remediates`. Never invent
others such as `supports`, `orders`, `related`, `transfer`, or `review`.

## Knowledge Point Rules

Extract 2-5 L3 points per student message, 1-3 for short material. Cap one input at
1 L1, 1 L2, and 5 L3 unless it explicitly spans multiple domains; split large batches.

A valid L3 label answers "what exactly should the student learn or demonstrate?".
Reject template labels such as 综合学习, 概念框架, 核心原理, 应用迁移, or 典型问题 —
those are tags or evidence kinds, never knowledge-point names.

Keep every structured JSON page under 4800 bytes. L3 summaries stay under 40 Chinese
characters and edge labels under 12. Detailed prose belongs in notes, not in the
graph, overlay, metrics, or memory pages.

Create `assessment_point` nodes only when the caller explicitly asks for assessment
points, practice design, or acceptance criteria.

## Overlay, Metrics, Memory

`student_overlay.md` holds JSON keyed by graph concept id with `mastery`,
`reviewPriority`, `mistakeCount`, `lastAction`, `lastTouchedAt`, `evidence`, and
`misconceptions`. Newly ingested material stays conservative, usually mastery 15-35.

`metrics.md` holds `knowledgeMastery`, `reviewPressure`, `misconceptionRisk`,
`learningInitiative`, `transferAbility`, `persistence`, `resourceGrounding`, and a
top-level `evidence` array. Each evidence item needs `id`, `kind`, `at`, `sourcePath`,
and `linkedNodeIds` — always the array form, even for a single node. Evidence nested
under a metric does not count.

Growth points are awarded by the platform from this evidence. Write only events that
actually happened: `knowledge_ingest`, `chapter_complete`, `practice_session`,
`practice_result`, `review_complete`, `research`, `qa`.

## Learning Path Recommendation

Read graph, overlay, metrics, recent notes, and practice records. Rank only concrete
L3 candidates by evidence: low mastery, high review priority, mistake count, recent
wrong answers, stale review time, available notes. Never recommend an L1, L2, tag, or
formula fragment.

Return one primary target plus a short queue of probe, review, and practice steps, and
explain the choice from persisted evidence. When no evidence-backed L3 target exists,
return `need_more_material` and ask for learning material instead of inventing a plan.

## Practice Generation

Write the session to `wiki/pages/practice-sessions/<session-id>.md` as one fenced JSON
block with `sessionId`, `source`, `targetNodes`, and `questions`.

`targetNodes` items are objects `{"id": "<L3 id>", "label": "<L3 label>"}`, never
strings. Each question needs `questionId`, `stem`, `type`, `nodeIds`, non-empty
`expectedAnswer`, and `rubric`.

Allowed types are `single_choice`, `multiple_choice`, `true_false`, `short_answer`.
Choice questions need at least two options shaped `{"key": "A", "text": "..."}`.
`true_false` uses exactly `{"key": "true", ...}` and `{"key": "false", ...}`.
`expectedAnswer` is always a string; multiple choice uses comma-separated keys
like `"A,C"`. With no answer choices, use `short_answer`.

Self-check the JSON before writing. Do not rewrite `course_graph.md` as part of
practice generation. Return the question stems in the reply so the student can answer.

## Practice Submission

Grade deterministically against the session file and write exactly one new result at
`wiki/pages/practice-results/<attemptId>.md` using the caller-supplied `attemptId`.
Never reuse the session id and never overwrite an existing result.

The result JSON needs `sessionId`, `attemptId`, `studentId`, `answers`, `score`,
`questionResults`, `wrongNodeIds`, and `masteryUpdates`. `score` is a number from 0
to 1. `questionResults` items carry only `questionId`, `correct`, `feedback` (under 80
Chinese characters), and `linkedNodeIds`. `masteryUpdates` items carry only `nodeId`,
`newMastery` (integer 0-100), `newConfidence` (0-1), and `reason` (under 60 Chinese
characters). `wrongNodeIds` lists every linked L3 node with a wrong answer.

Only after the result validates, project it into overlay, metrics, and memory. A turn
without a persisted result file and its projection is a failure, not a success.

## Learn Intent

`learn` follows the same evidence-first contract and additionally writes
`wiki/pages/learning-skills/<skill-id>.md` with `skillId`, `source`, `focus`,
`linkedNodeIds`, `procedure`, `verification`, and `status`.

`verification` states the task, rubric, pass criteria, and failure path. Initial
`status` is `draft` or `pending_verification`. Append a `skill_candidate` evidence item
to `metrics.md`. Do not raise mastery merely because material was read.

## Quality Gate

Before reporting completion, verify that `course_graph.md` has non-empty nodes and
edges, that L1/L2/L3 are all present, that every L3 point carries concrete domain
meaning, that every note links to at least one L3 node, that `student_overlay.md`
covers the new L3 nodes, and that `metrics.md` has top-level evidence linking to real
L3 ids. If a check fails, fix the files or report the failure.
