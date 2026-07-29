from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "course_package_cli.py"
SPEC = importlib.util.spec_from_file_location("course_package_cli", SCRIPT)
assert SPEC and SPEC.loader
cli = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cli)


class CoursePackageCliResumeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.workspace = tempfile.TemporaryDirectory()
        self.root = Path(self.workspace.name)
        self.course = {
            "title": "Course",
            "type": "practice",
            "lessons": [
                {
                    "id": "lesson-1",
                    "title": "Lesson 1",
                    "tasks": [
                        {
                            "id": "task-1",
                            "title": "Task 1",
                            "content": "Content 1",
                            "subtasks": [
                                {
                                    "id": "subtask-1",
                                    "title": "Subtask 1",
                                    "category": "study",
                                    "type": "markdown",
                                    "source": {"md": "Body"},
                                }
                            ],
                        },
                        {
                            "id": "task-2",
                            "title": "Task 2",
                            "content": "Content 2",
                            "subtasks": [],
                        },
                    ],
                },
                {
                    "id": "lesson-2",
                    "title": "Lesson 2",
                    "tasks": [
                        {
                            "id": "task-3",
                            "title": "Task 3",
                            "content": "Content 3",
                            "subtasks": [],
                        }
                    ],
                },
            ],
        }

    def tearDown(self) -> None:
        self.workspace.cleanup()

    def test_accepts_strict_partial_outline_prefix(self) -> None:
        outline = {
            "lessons": [
                {
                    "id": "lesson-1",
                    "title": "Lesson 1",
                    "tasks": [
                        {
                            "id": "task-1",
                            "title": "Task 1",
                            "content": "Content 1",
                            "subtasks": [
                                {
                                    "id": "subtask-1",
                                    "title": "Subtask 1",
                                    "type": "markdown",
                                    "source": {"md": "Body"},
                                }
                            ],
                        }
                    ],
                }
            ]
        }

        existing = cli.verify_outline_prefix_matches_package(
            outline,
            self.course,
            self.root,
            "course-1",
            "main",
        )

        self.assertEqual(1, len(existing))
        self.assertEqual(1, len(existing[0]["tasks"]))

    def test_rejects_non_prefix_outline(self) -> None:
        outline = {
            "lessons": [
                {"id": "lesson-1", "title": "Lesson 1", "tasks": []},
                {"id": "lesson-2", "title": "Lesson 2", "tasks": []},
            ]
        }

        with self.assertRaisesRegex(cli.CoursePackageError, "not a strict package prefix"):
            cli.verify_outline_prefix_matches_package(
                outline,
                self.course,
                self.root,
                "course-1",
                "main",
            )

    def test_rejects_mismatched_existing_task(self) -> None:
        outline = {
            "lessons": [
                {
                    "id": "lesson-1",
                    "title": "Lesson 1",
                    "tasks": [
                        {
                            "id": "task-1",
                            "title": "Wrong task",
                            "content": "Content 1",
                            "subtasks": [],
                        }
                    ],
                }
            ]
        }

        with self.assertRaisesRegex(cli.CoursePackageError, "task title mismatch"):
            cli.verify_outline_prefix_matches_package(
                outline,
                self.course,
                self.root,
                "course-1",
                "main",
            )

    def test_rejects_title_derived_task_id_instead_of_package_id(self) -> None:
        outline = {
            "lessons": [
                {
                    "id": "lesson-1",
                    "title": "Lesson 1",
                    "tasks": [
                        {
                            "id": "task_title_slug",
                            "title": "Task 1",
                            "content": "Content 1",
                            "subtasks": [
                                {
                                    "id": "subtask-1",
                                    "title": "Subtask 1",
                                    "type": "markdown",
                                    "source": {"md": "Body"},
                                }
                            ],
                        }
                    ],
                }
            ]
        }

        with self.assertRaisesRegex(cli.CoursePackageError, "task id mismatch"):
            cli.verify_outline_prefix_matches_package(
                outline,
                self.course,
                self.root,
                "course-1",
                "main",
            )

    def test_rejects_mismatched_existing_subtask_metadata(self) -> None:
        outline = {
            "lessons": [
                {
                    "id": "lesson-1",
                    "title": "Lesson 1",
                    "status": 1,
                    "sort": 0,
                    "tasks": [
                        {
                            "id": "task-1",
                            "title": "Task 1",
                            "content": "Content 1",
                            "subtasks": [
                                {
                                    "id": "subtask-1",
                                    "title": "Subtask 1",
                                    "category": "study",
                                    "type": "markdown",
                                    "metadata": {"unexpected": True},
                                    "source": {"md": "Body"},
                                }
                            ],
                        }
                    ],
                }
            ]
        }

        with self.assertRaisesRegex(cli.CoursePackageError, "metadata mismatch"):
            cli.verify_outline_prefix_matches_package(
                outline,
                self.course,
                self.root,
                "course-1",
                "main",
            )

    def test_rejects_mismatched_lesson_description_summary(self) -> None:
        outline_lessons = [{"id": "lesson-1", "tasks": []}]
        summaries = [{"id": "lesson-1", "description": "Wrong", "tasks": []}]

        with self.assertRaisesRegex(cli.CoursePackageError, "description mismatch"):
            cli.verify_lesson_summaries_match_prefix(
                summaries,
                self.course,
                outline_lessons,
                "course-1",
                "main",
            )

    def test_normalizes_markdown_newlines_and_course_asset_urls(self) -> None:
        source = self.root / "lessons" / "lesson-1" / "tasks" / "task-1" / "subtasks" / "body.md"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"Line 1\r\n\r\n![](../../../../../assets/image.png)\r\n")
        subtask = {
            "id": "subtask-1",
            "title": "Subtask 1",
            "category": "study",
            "type": "markdown",
            "source": {
                "path": "lessons/lesson-1/tasks/task-1/subtasks/body.md",
            },
        }

        normalized = cli.expected_outline_source(subtask, self.root, "course-1", "main")

        self.assertEqual(
            "Line 1\n\n![](/api/course/courses/course-1/git/raw?path=assets%2Fimage.png&ref=main)\n",
            normalized["md"],
        )

    def test_rejects_duplicate_task_id_across_lessons(self) -> None:
        course = json.loads(json.dumps(self.course))
        course["description"] = "Description"
        course["lessons"][1]["tasks"][0]["id"] = "task-1"
        package = {
            "schemaVersion": cli.SCHEMA_VERSION,
            "projectId": "course",
            "course": course,
            "publication": {"requested": True, "status": "pending_credentials"},
        }

        errors, _ = cli.validate_package(package, self.root)

        self.assertIn(
            "course.lessons[1].tasks[0].id is duplicated: task-1",
            errors,
        )

    def test_resume_course_must_match_package_identity(self) -> None:
        detail = {
            "id": "course-1",
            "title": "Course",
            "description": "",
            "type": "practice",
            "column_id": "column-1",
            "status": 0,
            "git_source": {"repo_name": "course-repo"},
        }

        cli.verify_resume_course_detail(
            detail,
            "course-1",
            {**self.course, "coverPath": "assets/cover.jpg"},
            "column-1",
            "course-repo",
            "main",
        )

        with self.assertRaisesRegex(cli.CoursePackageError, "repo_name mismatch"):
            cli.verify_resume_course_detail(
                detail,
                "course-1",
                self.course,
                "column-1",
                "another-repo",
                "main",
            )

        with self.assertRaisesRegex(cli.CoursePackageError, "draft status"):
            cli.verify_resume_course_detail(
                {**detail, "status": 1},
                "course-1",
                self.course,
                "column-1",
                "course-repo",
                "main",
            )

        cli.verify_resume_course_detail(
            {**detail, "status": 1},
            "course-1",
            self.course,
            "column-1",
            "course-repo",
            "main",
            allowed_statuses={0, 1},
        )
        with self.assertRaisesRegex(cli.CoursePackageError, "status is missing"):
            cli.verify_resume_course_detail(
                {key: value for key, value in detail.items() if key != "status"},
                "course-1",
                self.course,
                "column-1",
                "course-repo",
                "main",
            )
        with self.assertRaisesRegex(cli.CoursePackageError, "status is invalid"):
            cli.verify_resume_course_detail(
                {**detail, "status": None},
                "course-1",
                self.course,
                "column-1",
                "course-repo",
                "main",
            )

    def test_published_package_rejects_platform_draft_status(self) -> None:
        package = {
            "publication": {
                "status": "published",
                "courseId": "course-1",
                "publishedCommit": "commit-1",
            }
        }

        with self.assertRaisesRegex(cli.CoursePackageError, "reports draft"):
            cli.require_resume_status_consistency(package, 0)
        cli.require_resume_status_consistency(package, 1)
        cli.require_resume_status_consistency(
            {"publication": {"status": "prepared", "courseId": "course-1"}},
            0,
        )

    def test_waits_for_published_detail_to_reach_expected_commit(self) -> None:
        class Client:
            def __init__(self) -> None:
                self.responses = [
                    {"status": 0, "resolved_commit": "old"},
                    {"status": 1, "resolved_commit": "commit-1"},
                ]

            def call(self, method, route):
                self.assert_call = (method, route)
                return self.responses.pop(0)

        client = Client()
        detail = cli.wait_for_published_detail(
            client,
            "course-1",
            "commit-1",
            attempts=2,
            delay_seconds=0,
        )

        self.assertEqual(1, detail["status"])
        self.assertEqual("commit-1", detail["resolved_commit"])

    def test_waits_through_transient_course_api_error(self) -> None:
        class Client:
            def __init__(self) -> None:
                self.attempts = 0

            def call(self, method, route):
                self.attempts += 1
                if self.attempts == 1:
                    raise cli.CoursePackageError("temporary read failure")
                return {"status": 1, "resolved_commit": "commit-1"}

        client = Client()
        detail = cli.wait_for_published_detail(
            client,
            "course-1",
            "commit-1",
            attempts=2,
            delay_seconds=0,
        )

        self.assertEqual(2, client.attempts)
        self.assertEqual("commit-1", detail["resolved_commit"])

    def test_invalid_json_response_is_a_retryable_course_api_error(self) -> None:
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self):
                return b"<html>upstream error</html>"

        client = cli.CourseApiClient("https://example.invalid", "token", 1)
        request = cli.request.Request("https://example.invalid/courses/course-1")
        with mock.patch.object(cli.request, "urlopen", return_value=Response()):
            with self.assertRaisesRegex(cli.CoursePackageError, "returned invalid JSON"):
                client._read_json_response(request, "GET", "/courses/course-1")

    def test_observes_published_status_before_later_detail_validation(self) -> None:
        args = type("Args", (), {})()

        status = cli.observe_course_status(
            args,
            "course-1",
            {"status": 1, "resolved_commit": "commit-1"},
            "resume course",
        )

        self.assertEqual(1, status)
        self.assertEqual("course-1", args.partial_course_id)
        self.assertTrue(args.platform_published)
        self.assertEqual("commit-1", args.confirmed_published_commit)
        with self.assertRaisesRegex(cli.CoursePackageError, "status is missing"):
            cli.observe_course_status(args, "course-1", {}, "course before publish")

    def test_resume_course_id_is_bound_to_package_publication_identity(self) -> None:
        package = {
            "publication": {
                "status": "prepared",
                "courseId": "course-1",
            }
        }

        cli.require_resume_publication_identity(package, "course-1")
        with self.assertRaisesRegex(cli.CoursePackageError, "use --resume-course-id"):
            cli.require_resume_publication_identity(package, "")
        with self.assertRaisesRegex(cli.CoursePackageError, "does not match"):
            cli.require_resume_publication_identity(package, "course-2")

    def test_published_resume_requires_matching_publish_evidence(self) -> None:
        action_log = self.root / "api-actions.jsonl"
        rows = [
            {
                "method": "POST",
                "path": "/courses/course-1/publish",
                "purpose": "publish_course",
                "result": {
                    "courseId": "course-1",
                    "publishedCommit": "commit-1",
                },
            },
        ]
        action_log.write_text(
            "\n".join(json.dumps(row) for row in rows) + "\n",
            encoding="utf-8",
        )

        cli.require_publish_action_evidence(
            action_log,
            "course-1",
            "commit-1",
        )
        with self.assertRaisesRegex(cli.CoursePackageError, "publish commit evidence"):
            cli.require_publish_action_evidence(
                action_log,
                "course-1",
                "commit-2",
            )

    def test_published_resume_accepts_exact_package_evidence_without_action_log(self) -> None:
        package = {
            "publication": {
                "status": "published",
                "courseId": "course-1",
                "publishedCommit": "commit-1",
            }
        }

        self.assertEqual(
            "package",
            cli.require_published_resume_evidence(
                package,
                None,
                "course-1",
                "commit-1",
            ),
        )
        with self.assertRaisesRegex(cli.CoursePackageError, "original actions log"):
            cli.require_published_resume_evidence(
                package,
                None,
                "course-1",
                "commit-2",
            )

    def test_published_assets_require_exact_paths_and_content(self) -> None:
        asset = self.root / "assets" / "image.png"
        asset.parent.mkdir(parents=True)
        asset.write_bytes(b"image")

        class Client:
            def __init__(self, remote_data: bytes = b"image") -> None:
                self.remote_data = remote_data

            def call(self, method, route):
                self.assert_call = (method, route)
                return {"assets": ["assets/image.png"], "commit": "commit-1"}

            def download_file(self, route):
                self.download_route = route
                return self.remote_data

        evidence = cli.verify_published_assets(
            Client(),
            "course-1",
            "commit-1",
            self.root,
        )
        self.assertEqual(1, evidence["assets"])
        self.assertEqual(5, evidence["bytes"])
        self.assertEqual(64, len(evidence["assetManifestSha256"]))

        with self.assertRaisesRegex(cli.CoursePackageError, "content mismatch"):
            cli.verify_published_assets(
                Client(b"other"),
                "course-1",
                "commit-1",
                self.root,
            )

        class PathMismatchClient(Client):
            def call(self, method, route):
                return {"assets": ["assets/other.png"], "commit": "commit-1"}

        with self.assertRaisesRegex(cli.CoursePackageError, "paths mismatch"):
            cli.verify_published_assets(
                PathMismatchClient(),
                "course-1",
                "commit-1",
                self.root,
            )

        class CommitMismatchClient(Client):
            def call(self, method, route):
                return {"assets": ["assets/image.png"], "commit": "other-commit"}

        with self.assertRaisesRegex(cli.CoursePackageError, "listing commit mismatch"):
            cli.verify_published_assets(
                CommitMismatchClient(),
                "course-1",
                "commit-1",
                self.root,
            )

    def test_course_url_requires_explicit_course_id_placeholder(self) -> None:
        self.assertEqual(
            "https://zy.oilan.ai/courses/course-1",
            cli.render_course_url("https://zy.oilan.ai/courses/{course_id}", "course-1"),
        )
        with self.assertRaisesRegex(cli.CoursePackageError, "must contain"):
            cli.render_course_url("https://zy.oilan.ai/courses", "course-1")

    def test_sync_course_assets_uploads_exact_assets_tree(self) -> None:
        first = self.root / "assets" / "images" / "one.png"
        second = self.root / "assets" / "video.mp4"
        first.parent.mkdir(parents=True)
        first.write_bytes(b"one")
        second.write_bytes(b"video")

        class Client:
            def __init__(self) -> None:
                self.calls = []
                self.remote = {
                    "assets/images/one.png",
                    "assets/video.mp4",
                    "assets/stale.png",
                }

            def upload_file(self, route, file_path):
                self.calls.append((route, file_path))
                repo_path = cli.parse.parse_qs(cli.parse.urlsplit(route).query)["path"][0]
                self.remote.add(repo_path)
                return {
                    "path": repo_path,
                    "commit": "commit-1",
                    "skipped": repo_path.endswith("video.mp4"),
                }

            def call(self, method, route):
                if method == "GET":
                    return {"assets": sorted(self.remote), "commit": "commit-1"}
                if method == "DELETE":
                    repo_path = cli.parse.parse_qs(cli.parse.urlsplit(route).query)["path"][0]
                    self.remote.discard(repo_path)
                    return {"path": repo_path, "commit": "commit-2", "skipped": False}
                raise AssertionError((method, route))

        client = Client()
        result = cli.sync_course_assets(client, "course-1", self.root)

        self.assertEqual(
            ["assets/images/one.png", "assets/video.mp4"],
            [
                cli.parse.parse_qs(cli.parse.urlsplit(route).query)["path"][0]
                for route, _ in client.calls
            ],
        )
        self.assertEqual(
            {"assets": 2, "uploaded": 1, "skipped": 1, "deleted": 1, "bytes": 8},
            result,
        )

    def test_sync_course_assets_requires_nonempty_assets_directory(self) -> None:
        with self.assertRaisesRegex(cli.CoursePackageError, "requires an assets directory"):
            cli.list_course_assets(self.root)

    def test_rewrites_inline_course_asset_links_to_course_proxy(self) -> None:
        rewritten = cli.rewrite_inline_asset_links(
            "Before ![](assets/image.png) after",
            "course-1",
            "main",
            "course description",
        )
        self.assertEqual(
            "Before ![](/api/course/courses/course-1/git/raw?path=assets%2Fimage.png&ref=main) after",
            rewritten,
        )
        with self.assertRaisesRegex(cli.CoursePackageError, "must point under assets"):
            cli.rewrite_inline_asset_links(
                "[Other](lessons/other.md)",
                "course-1",
                "main",
                "task content",
            )

    def test_package_cover_path_must_be_an_asset_image(self) -> None:
        package = {
            "schemaVersion": cli.SCHEMA_VERSION,
            "projectId": "course",
            "course": {
                **self.course,
                "description": "Description",
                "coverPath": "assets/images/cover.jpg",
            },
            "publication": {"requested": True, "status": "pending_credentials"},
        }
        cover = self.root / "assets" / "images" / "cover.jpg"
        cover.parent.mkdir(parents=True)
        cover.write_bytes(b"image")

        errors, _ = cli.validate_package(package, self.root)
        self.assertEqual([], errors)

        package["course"]["coverPath"] = "cover.jpg"
        errors, _ = cli.validate_package(package, self.root)
        self.assertIn("course.coverPath must point under assets/", errors)

    def test_publish_failure_records_runtime_partial_course_id_without_action_log(self) -> None:
        package_path = self.root / "course-package.json"
        package_path.write_text(
            '{"schemaVersion":"zhiyong.course-package/v1","publication":{"status":"pending_credentials"}}',
            encoding="utf-8",
        )
        args = type(
            "Args",
            (),
            {
                "file": str(package_path),
                "actions_log": None,
                "resume_course_id": None,
                "partial_course_id": "course-1",
            },
        )()

        cli.mark_publish_failed(args, "upload failed")

        publication = cli.load_package(package_path)["publication"]
        self.assertEqual("failed", publication["status"])
        self.assertEqual("course-1", publication["partialCourseId"])

    def test_publish_verification_failure_preserves_published_state(self) -> None:
        package_path = self.root / "course-package.json"
        package_path.write_text(
            '{"schemaVersion":"zhiyong.course-package/v1","publication":{"status":"pending_credentials"}}',
            encoding="utf-8",
        )
        args = type(
            "Args",
            (),
            {
                "file": str(package_path),
                "actions_log": None,
                "resume_course_id": None,
                "partial_course_id": "course-1",
                "confirmed_published_commit": "commit-1",
            },
        )()

        cli.mark_publish_failed(args, "readback failed")

        publication = cli.load_package(package_path)["publication"]
        self.assertEqual("published_unverified", publication["status"])
        self.assertEqual("course-1", publication["courseId"])
        self.assertEqual("commit-1", publication["publishedCommit"])

    def test_known_platform_published_state_survives_missing_commit_readback(self) -> None:
        package_path = self.root / "course-package.json"
        package_path.write_text(
            '{"schemaVersion":"zhiyong.course-package/v1","publication":{"status":"pending_credentials"}}',
            encoding="utf-8",
        )
        args = type(
            "Args",
            (),
            {
                "file": str(package_path),
                "actions_log": None,
                "resume_course_id": "course-1",
                "partial_course_id": "course-1",
                "platform_published": True,
                "confirmed_published_commit": "",
            },
        )()

        cli.mark_publish_failed(args, "published detail has no resolved commit")

        publication = cli.load_package(package_path)["publication"]
        self.assertEqual("published_unverified", publication["status"])
        self.assertEqual("course-1", publication["courseId"])
        self.assertNotIn("publishedCommit", publication)

    def test_existing_published_unverified_identity_survives_early_failure(self) -> None:
        package_path = self.root / "course-package.json"
        package_path.write_text(
            json.dumps(
                {
                    "schemaVersion": "zhiyong.course-package/v1",
                    "publication": {
                        "status": "published_unverified",
                        "courseId": "course-1",
                        "publishedCommit": "commit-1",
                    },
                }
            ),
            encoding="utf-8",
        )
        args = type(
            "Args",
            (),
            {
                "file": str(package_path),
                "actions_log": None,
                "resume_course_id": None,
            },
        )()

        cli.mark_publish_failed(args, "teacher token is missing")

        publication = cli.load_package(package_path)["publication"]
        self.assertEqual("published_unverified", publication["status"])
        self.assertEqual("course-1", publication["courseId"])
        self.assertEqual("commit-1", publication["publishedCommit"])

    def test_existing_published_package_is_never_downgraded_by_later_failure(self) -> None:
        package_path = self.root / "course-package.json"
        original = {
            "schemaVersion": "zhiyong.course-package/v1",
            "publication": {
                "status": "published",
                "courseId": "course-1",
                "publishedCommit": "commit-1",
                "verifiedAt": "2026-07-29T00:00:00Z",
            },
        }
        package_path.write_text(json.dumps(original), encoding="utf-8")
        args = type(
            "Args",
            (),
            {
                "file": str(package_path),
                "actions_log": None,
                "resume_course_id": "course-2",
            },
        )()

        cli.mark_publish_failed(args, "resume identity mismatch")

        self.assertEqual(original, cli.load_package(package_path))

    def test_platform_published_package_cannot_be_marked_pending(self) -> None:
        package_path = self.root / "course-package.json"
        package_path.write_text(
            '{"schemaVersion":"zhiyong.course-package/v1","publication":{"status":"published_unverified"}}',
            encoding="utf-8",
        )
        args = type(
            "Args",
            (),
            {
                "file": str(package_path),
                "reason": "credentials_missing",
            },
        )()

        with self.assertRaisesRegex(cli.CoursePackageError, "platform-published"):
            cli.command_publication_pending(args)


if __name__ == "__main__":
    unittest.main()
