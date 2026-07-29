# Course Platform Publish Contract

Run publication only after package validation succeeds.

```bash
ZHIYONG_PLATFORM_API_KEY='...' \
python3 <this-skill>/scripts/course_package_cli.py publish \
  --file output/projects/<project-id>/artifacts/course-package.json \
  --workspace-root . \
  --base-url https://<explicit-host>/api/course \
  --course-url-template https://<explicit-host>/courses/{course_id} \
  --actions-log output/projects/<project-id>/artifacts/api-actions.jsonl
```

The command performs:

1. `GET /columns` and exact column resolution.
2. `POST /courses/git-source` with `column_id`.
3. `POST /courses` with the returned `git_source`.
4. Course-scoped lesson and task writes; subtasks are part of each task payload.
   Relative Markdown links in course/lesson/task inline text must point under
   `assets/`; the CLI rewrites them to the authenticated Course Git raw proxy.
5. With `--sync-assets`, uploads every regular file under `workspace-root/assets/`
   through `POST /courses/{courseId}/git/assets`.
6. Course detail, lesson summary, and content-inclusive outline readback.
7. `POST /courses/{courseId}/publish`.
8. Published course detail, lesson summary, and outline readback.
9. Records the expected course URL when `--course-url-template` is supplied.

The CLI fails if the token/base URL is absent, the column is missing or ambiguous, the
Git source lacks an initialization commit, the publish response has no verified commit,
the course detail `resolved_commit` differs from it, or readback counts do not match the
package. A recorded URL is not treated as browser evidence: a real browser must still
load the course page, enter the learning view, verify representative assets, and check
console and network failures.

For packages with local assets, prepare the complete draft before synchronizing Course
Git:

```bash
ZHIYONG_PLATFORM_API_KEY='...' \
python3 <this-skill>/scripts/course_package_cli.py publish \
  --file output/projects/<project-id>/artifacts/course-package.json \
  --workspace-root . \
  --base-url https://<explicit-host>/api/course \
  --repo-name <repo-name> \
  --prepare-only \
  --sync-assets
```

`--prepare-only` creates or resumes the draft, writes all lessons and tasks, performs
strict readback, records `publication.status=prepared`, and does not publish.
`--sync-assets` uses the teacher-scoped Course API to write the exact validated
`assets/` tree to the course repository, deletes remote files absent from the local
tree, and verifies the final path set. Asset mutation is rejected once the course is
published. The CLI does not read or accept a Gitea token.
If `course.coverPath` is present, the CLI also binds that uploaded image as the course
cover and verifies the proxy URL during draft and published readback.
After the prepared result is reviewed, rerun `publish` with
`--resume-course-id <course-id> --sync-assets` to idempotently verify the assets and
advance the published commit.

To resume an interrupted publish, pass the existing course explicitly:

```bash
ZHIYONG_PLATFORM_API_KEY='...' \
python3 <this-skill>/scripts/course_package_cli.py publish \
  --file output/projects/<project-id>/artifacts/course-package.json \
  --workspace-root . \
  --base-url https://<explicit-host>/api/course \
  --resume-course-id <course-id> \
  --sync-assets
```

Resume is allowed only when the existing course identity and Git repository match the
package, and its current outline is an exact prefix of the package. The CLI creates only
the missing lessons and tasks, then runs the same publish and readback checks. It never
guesses a course ID or accepts divergent lesson/task/subtask semantics.

After `POST /publish`, the CLI performs a bounded read-after-write consistency check for
`status=1` and the exact returned `published_commit`. If the publish request succeeded but
the process stopped before recording success, rerunning with the same
`--resume-course-id` may reconcile an already-published course without further mutation.
That recovery requires either the package's own exact `courseId` and `publishedCommit`
record or the original actions log proving the same publish action and commit. Once a
package records `courseId` or `partialCourseId`, every later publish invocation must pass
that exact value with `--resume-course-id`; the CLI refuses to create or resume a
different course. If a package already records `published` or `published_unverified` but
the platform reports `status=0`, the CLI treats that as an authority conflict and refuses
all mutation. With `--sync-assets`, the CLI also requires the remote asset path set to
equal the local tree and compares every local file SHA-256 with the raw file at that
immutable published commit. The complete outline, summaries, cover URL, and commit must
still match. Without `--sync-assets`, recovery does not require an `assets/` directory.
The Course API asset-list GET must return the draft branch commit for `status=0`, but for
`status=1` it must list exactly `git_source.published_commit`; published verification must
never read a mutable branch HEAD. Asset upload and deletion remain draft-only operations.

Lesson, task, and subtask IDs in the package are authoritative routing identities. The
CLI sends lesson and task package IDs through the Course API `name` fields and requires
every outline readback ID to match exactly. Title-derived or duplicate platform IDs are
rejected even when titles and content happen to match.

Once the platform has returned a publish commit, a later readback failure is recorded as
`publication.status=published_unverified`, including the course ID and publish commit.
An explicitly resumed course that already reports `status=1` also keeps this state if a
later identity or content check fails; when the malformed detail omits its resolved
commit, the record keeps the course ID and error without inventing a commit. This state
cannot be changed to `pending_credentials`; rerun `publish` with the explicit course ID
to complete authoritative readback without mutating the published course.

Every course detail read must include an explicit integer/string `status` of `0` or `1`.
The final pre-publish read must report `status=0`; missing, malformed, or already-published
status aborts before the publish request. Malformed JSON and transient Course API failures
during post-publish readback are retried within the bounded consistency window.

If the current teacher credential is absent, do not call `publish`. Record the blocked
state with `publication-pending --file <course-package.json>` and return the validated
course package as the result.

The action log is sanitized and contains no token or Authorization header.
