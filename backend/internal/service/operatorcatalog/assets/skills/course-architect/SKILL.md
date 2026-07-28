---
name: course-architect
description: Design a course blueprint from evidence and observable learner outcomes, including progression, lessons, tasks, deliverables, acceptance criteria, labs, practice, and slide requirements. Use before full lesson authoring.
---

# Course Architect

Design structure before writing full lesson bodies. Apply backward design: learner
evidence first, then tasks and teaching activities.

## Required Outputs

Write:

- `output/projects/<project-id>/architecture/course-architecture-plan.md`
- one `architecture/chapter-XX-production-plan.md` per lesson

The course plan must include title, audience, prerequisites, final capability, source
mapping, progression rationale, and quality risks.

Each chapter plan must include:

- observable objective and main learner deliverable;
- 3-6 distinct tasks with acceptance evidence;
- why learn, what to learn, how to act, what to submit, how to verify;
- chapter-specific questions, explanation strategy, failure cases, and citations;
- lab, practice, and slide requirements when needed.

Do not reuse generic objectives, questions, examples, or rubrics across chapters by
changing only the title. Do not publish or call platform APIs.

After approval, initialize the structured package with the course-builder CLI and add
the approved lesson/task identifiers. The architecture files remain the design source;
the course package is the machine-readable delivery contract.
