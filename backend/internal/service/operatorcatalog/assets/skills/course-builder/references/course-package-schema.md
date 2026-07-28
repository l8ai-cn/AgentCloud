# Course Package Schema

The canonical artifact is UTF-8 JSON:

```json
{
  "schemaVersion": "zhiyong.course-package/v1",
  "projectId": "agent-course",
  "course": {
    "title": "Agent 工程实践",
    "description": "从任务契约到可验收交付",
    "type": "practice",
    "columnSelector": "人工智能",
    "lessons": [
      {
        "id": "lesson-01",
        "title": "从需求到任务契约",
        "description": "",
        "status": 1,
        "sort": 1,
        "tasks": [
          {
            "id": "task-01",
            "title": "写出任务契约",
            "contentPath": "output/projects/agent-course/artifacts/learning/task-01.md",
            "type": "learning",
            "duration": 45,
            "status": 1,
            "sort": 1,
            "subtasks": []
          }
        ]
      }
    ]
  },
  "publication": {
    "requested": false,
    "status": "not_requested"
  }
}
```

`columnSelector` may be an exact enabled column id, code, or name. It is optional for
artifact review but required for publication when more than one enabled column exists.

Task content uses either `content` or `contentPath`; prefer `contentPath`. A
`markdown`, `html`, `iframe`, or `quiz` subtask may carry `source.path`; the publish
CLI reads the file and sends API-supported `source.md`, a data URL in
`source.url`/`source.iframe_src`, or `source.question_json`, never the private workspace
path. Other subtask types must use API-native source fields such as
`source.lab_task_id`. Paths must be relative, must not contain `..`, and must resolve
inside the supplied workspace root.

`validate`, `summary`, and `publish` require an explicit `--workspace-root`. Run all
three against the same root so validation and publication consume the same files.

For atomic subtask creation, use `--source-path`, `--source-url`, or `--source-json`.
These options are mutually exclusive. Unsupported source fields fail validation rather
than being silently discarded by the platform schema.

Publication status values are `not_requested`, `pending_credentials`, `published`, or
`failed`. A published record contains `courseId`, `publishedCommit`, and `verifiedAt`.
