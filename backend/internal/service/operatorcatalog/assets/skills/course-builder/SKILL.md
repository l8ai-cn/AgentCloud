---
name: course-builder
description: Turn an approved course architecture and source evidence into substantive learning files and a validated machine-readable course package. Use for lesson/task authoring, structured course output, validation, and credentialed publication.
---

# Course Builder

Build material students can read, act on, and submit as evidence. A course outline or a
list of filenames is not course content.

## Required Artifact Chain

For each task, create:

1. source map;
2. knowledge and evidence cards;
3. learning file;
4. teacher script;
5. student worksheet;
6. submission template;
7. lab/practice requirement when applicable;
8. quality audit.

Each learning file must contain a concrete failure case, plain-language explanation,
source citations, an executable example, learner action, troubleshooting, submission
evidence, and self-check questions.

## Structured Course Package

Use the bundled CLI; do not hand-maintain a second package format.

```bash
python3 <this-skill>/scripts/course_package_cli.py init \
  --file output/projects/<project-id>/artifacts/course-package.json \
  --project-id <project-id> \
  --title "<course title>" \
  --description "<description>" \
  --type practice

python3 <this-skill>/scripts/course_package_cli.py lesson-add ...
python3 <this-skill>/scripts/course_package_cli.py task-add ...
python3 <this-skill>/scripts/course_package_cli.py subtask-add ...
python3 <this-skill>/scripts/course_package_cli.py validate \
  --file output/projects/<project-id>/artifacts/course-package.json \
  --workspace-root .

python3 <this-skill>/scripts/course_package_cli.py summary \
  --file output/projects/<project-id>/artifacts/course-package.json \
  --workspace-root .
```

Read `references/course-package-schema.md` before creating the package. Read
`references/platform-publish-contract.md` only when the teacher explicitly requests
platform publication.

## Quality Gate

- At least one lesson and one task must exist.
- Every id is unique within its scope.
- Referenced content/source paths are repository-relative, stay inside the workspace,
  and exist.
- No placeholder token such as `{courseId}` remains.
- The CLI validator exits 0 and its summary is recorded in `quality.md`.
- Platform publication is successful only after strict API readback. Missing
  credentials must be recorded with `publication-pending`, never a success claim.
