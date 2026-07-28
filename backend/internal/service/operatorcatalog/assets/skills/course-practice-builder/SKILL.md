---
name: course-practice-builder
description: Build objective-aligned practice, quizzes, answer explanations, knowledge-point mapping, scoring rules, and evidence-based assessment artifacts for a course task.
---

# Course Practice Builder

Write practice assets under
`output/projects/<project-id>/artifacts/practice/<practice-id>/`.

Required output:

- `questions.json`: stable ids, type, stem, options when applicable, answer, rationale,
  knowledge point, difficulty, and evidence target.
- `rubric.md`: scoring and pass criteria.
- `review.md`: ambiguity, coverage, and teacher-review findings.

Cover concept understanding, application, diagnosis, and delivery evidence where
appropriate. Every answer explanation states why the correct answer works and why
plausible alternatives fail.

Map the resulting quiz into `course-package.json` through a package subtask. Use one
authoritative question source. Do not maintain conflicting inline questions, separate
JSON, and question-id lists.

Do not claim platform question-bank creation unless a current teacher-scoped API call
and readback were executed.
