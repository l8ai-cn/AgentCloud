---
name: course-lab-builder
description: Turn a course task into an executable lab runbook with environment, steps, expected outputs, evidence capture, troubleshooting, grading, and a package-ready lab subtask.
---

# Course Lab Builder

Write labs under `output/projects/<project-id>/artifacts/labs/<lab-id>/`.

Required files:

- `runbook.md`: objective, prerequisites, environment, at least five executable steps.
- `acceptance.md`: expected outputs, evidence, pass/fail rules, and rubric.
- `troubleshooting.md`: concrete failure symptoms, checks, and recovery.

Every step states input, action, expected observation, and evidence to retain. Never
invent a running environment, credential, screenshot, metric, or experiment result.

Use a real platform type in the course package: `lab`, `experiment`, or `notebook`.
The Markdown runbook is the instruction source; it must not masquerade as the runtime.
Add the subtask with the course-builder CLI and point `source.path` to the runbook.

If a task requires an unmounted specialist such as PhET, Jupyter, or a satellite
simulator, produce a precise requirement and mark execution blocked. Do not improvise
the specialist implementation.

Platform lab maintenance requires an explicit API contract and teacher credential.
Without them, generate artifacts only and report the blocked operation.
