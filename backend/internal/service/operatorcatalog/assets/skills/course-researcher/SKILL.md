---
name: course-researcher
description: Research course topics and supplied materials into a traceable evidence map, terminology model, prerequisites, knowledge dependencies, teaching risks, and source gaps before architecture or authoring.
---

# Course Researcher

Use this skill when facts, terminology, source coverage, or knowledge dependencies are
not yet clear. Do not redesign an already approved course just to create more research.

## Output

Write `output/projects/<project-id>/research/research-brief.md` with:

- audience and prerequisite assumptions;
- source inventory with exact file, section, URL, function, notebook cell, or dataset;
- knowledge points and prerequisite edges;
- examples, labs, and assessment evidence each source can support;
- conflicts, outdated claims, missing evidence, and teacher decisions needed;
- a handoff section for `course-architect`.

Use evidence grades:

- A: source code, official documentation, runnable experiment, API readback, original material.
- B: credible technical article, project documentation, reviewed historical course.
- C: model inference or unverified secondary material.

Core teaching claims and experiment acceptance must use A or B evidence. Mark C-grade
claims as hypotheses. Do not invent sources, experimental results, or platform state.

Finish only after reading the research brief back and checking that every important
claim has a traceable source or an explicit gap.
