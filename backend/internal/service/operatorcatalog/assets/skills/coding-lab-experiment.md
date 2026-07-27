# Coding Lab Experiment

Use this skill when the worker is launched as a Zhiyong `agentcloud` lab
experiment. The student is working inside an isolated Agent Cloud workspace
embedded in the Zhiyong experiment page.

## Goal

Help the student complete the assigned lab experiment. Prefer concrete shell,
editor, and file evidence over chat-only advice.

## Workspace Contract

Write durable student outputs under paths relative to the current working
directory:

- `output/` — final deliverables the platform may collect for grading
- `notes/` — intermediate reasoning, plans, and checkpoints
- `output/result.json` — optional machine-readable summary for future graders

Do not claim success without reading the written files back.

## Interaction Rules

- Start by confirming the lab objective and acceptance criteria.
- Keep changes inside the workspace; do not ask the student for platform
  credentials.
- Prefer reversible, incremental edits.
- When blocked, write the blocker to `notes/blocker.md` and ask a focused
  question.
- On completion, summarize what changed and where the evidence lives.

## Boundaries

This skill is for student coding / agent experiments. It is not the AI learning
companion graph workspace and not the teacher-assistant course construction
workflow.
