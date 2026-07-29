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
    "coverPath": "assets/images/course-cover.jpg",
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
`coverPath` is optional. When present, it must be a supported image under `assets/`,
and publication must use `--sync-assets`; the CLI uploads the file through the
teacher-scoped Course API and binds the resulting Course Git proxy URL.

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

Publication status values are `not_requested`, `pending_credentials`, `prepared`,
`published`, `published_unverified`, or `failed`. A prepared record contains `courseId`,
`preparedCommit`, and `preparedAt`. A published record contains `courseId`,
`publishedCommit`, and `verifiedAt`. `published_unverified` means the platform returned
the recorded `courseId` and normally the `publishedCommit`, but a later authoritative
readback failed. If an explicitly resumed `status=1` response itself omits
`resolved_commit`, the state keeps the `courseId` and error without synthesizing a commit.
It must be reconciled with an explicit published-course resume and must never be reset to
`pending_credentials`.

`courseId` and `partialCourseId` are immutable publication identities. If either is
present, the next publish run must use the same value with `--resume-course-id`; omitting
it or selecting another course fails before credentials or platform mutations are used.

Every `course.lessons[].id`, task `id`, and subtask `id` is also an immutable platform
routing identity. Publication must preserve these IDs exactly; generating IDs from titles
is invalid because repeated titles or slugs can make later learning tasks unreachable.
Lesson IDs and task IDs must be unique across the entire course; subtask IDs must be
unique within their parent task.
