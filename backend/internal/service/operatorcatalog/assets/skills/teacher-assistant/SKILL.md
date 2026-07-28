---
name: teacher-assistant
description: Orchestrate teacher-facing course research, architecture, content, labs, practice, slides, platform publication, and delivery verification. Use for a durable teacher workspace, not for student tutoring or generic chat.
---

# Teacher Assistant

Run each build as a durable project. Route specialist work to the mounted course
skills and treat their files as the source of truth. Do not replace a missing skill
with improvised output.

## Required Workflow

1. Create `output/projects/<project-id>/brief.json` from the teacher's request.
2. Write `plan.md` with selected skills, inputs, deliverables, quality gates, and
   whether platform publication was requested.
3. Route work in this order when applicable:
   `course-researcher` -> `course-architect` -> `course-builder` ->
   `course-lab-builder` / `course-practice-builder` / `course-ppt`.
4. Require `artifacts/course-package.json` for every structured course build.
5. Run the bundled `course-builder/scripts/course_package_cli.py validate` command.
6. Write `quality.md` with evidence, missing items, and an explicit result:
   `complete`, `partial`, or `blocked`.
7. Read every required output back before reporting completion.

Read `references/workspace-contract.md` before starting a build. Read
`references/platform-identity-boundary.md` before any platform operation.

## Skill Routing

- `course-researcher`: evidence map, source gaps, terminology, prerequisites.
- `course-architect`: course progression, lessons, tasks, observable acceptance.
- `course-builder`: learning files and the validated structured course package.
- `course-lab-builder`: executable lab runbooks and evidence checks.
- `course-practice-builder`: questions, answers, rubrics, quiz mapping.
- `course-ppt`: classroom slide plan and speaker notes.

## Publication Boundary

The AgentCloud embed session does not by itself prove that a teacher-scoped Zhiyong
API credential is available inside the worker. Never claim that a course was imported
or published merely because files were generated.

Platform publication is allowed only when the course package CLI receives an explicit
course API base URL and a teacher-scoped bearer token. The CLI must resolve an exact
enabled column, create the Git source, create the course tree, publish it, and read
back both course detail and non-empty outline.

Without that credential path, finish the validated course package and set publication
to `pending_credentials`. This is an explicit blocked platform step, not successful
publication and not a fallback.

## Completion

A course build is complete only when:

- `brief.json`, `plan.md`, `artifacts/course-package.json`, and `quality.md` exist.
- The package validator exits with status 0.
- The package contains at least one lesson and one task with real content.
- Every claimed specialist artifact exists and was read back.
- If publication was requested, API readback contains a course id, a non-empty
  `published_commit`, and the expected lesson/task counts.
