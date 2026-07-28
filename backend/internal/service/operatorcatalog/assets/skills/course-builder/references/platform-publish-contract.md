# Course Platform Publish Contract

Run publication only after package validation succeeds.

```bash
ZHIYONG_PLATFORM_API_KEY='...' \
python3 <this-skill>/scripts/course_package_cli.py publish \
  --file output/projects/<project-id>/artifacts/course-package.json \
  --workspace-root . \
  --base-url https://<explicit-host>/api/course \
  --actions-log output/projects/<project-id>/artifacts/api-actions.jsonl
```

The command performs:

1. `GET /columns` and exact column resolution.
2. `POST /courses/git-source` with `column_id`.
3. `POST /courses` with the returned `git_source`.
4. Course-scoped lesson and task writes; subtasks are part of each task payload.
5. `POST /courses/{courseId}/publish`.
6. Course detail and content-inclusive outline readback.

The CLI fails if the token/base URL is absent, the column is missing or ambiguous, the
Git source lacks a published commit, the final published commit is empty, or readback
counts do not match the package.

If the current teacher credential is absent, do not call `publish`. Record the blocked
state with `publication-pending --file <course-package.json>` and return the validated
course package as the result.

The action log is sanitized and contains no token or Authorization header.
