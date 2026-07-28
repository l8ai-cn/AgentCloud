# Teacher Workspace Contract

Use paths relative to the current worker workspace:

```text
output/projects/<project-id>/
  brief.json
  plan.md
  research/
  architecture/
  artifacts/
    course-package.json
    learning/
    labs/
    practice/
    slides/
    api-actions.jsonl
  quality.md
  events.jsonl
```

`brief.json` records the normalized request, audience, target capability, supplied
materials, requested publication state, and unresolved inputs.

`plan.md` records the ordered skill workflow and concrete output paths. Update it when
scope changes.

`events.jsonl` is append-only. Each line contains `at`, `type`, `status`, and
non-secret evidence paths.

`api-actions.jsonl` records method, path, purpose, returned resource ids, and readback
result. Never store Authorization headers, tokens, passwords, cookies, or connection
strings.

Do not report an artifact by intended path. Read the file, validate its content, and
then cite the path.
