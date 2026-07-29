package operatorcatalog

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCoursePackageCLIPublishesAndReadsBackStructuredCourse(t *testing.T) {
	t.Helper()
	var requests []string
	published := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer teacher-token", r.Header.Get("Authorization"))
		requests = append(requests, r.Method+" "+r.URL.RequestURI())
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/columns":
			writeCourseAPIResult(t, w, []map[string]any{
				{"id": "column-ai", "name": "人工智能", "code": "ai"},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/courses/git-source":
			body := readCourseAPIRequest(t, r)
			require.Equal(t, "column-ai", body["column_id"])
			writeCourseAPIResult(t, w, map[string]any{
				"git_source": map[string]any{
					"repo_owner":       "course",
					"repo_name":        "agent-course",
					"repo_ref":         "main",
					"repo_subpath":     ".",
					"manifest_path":    "course.yaml",
					"published_commit": "commit-init",
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/courses":
			body := readCourseAPIRequest(t, r)
			require.Equal(t, "column-ai", body["column_id"])
			require.Equal(t, "commit-init", body["git_source"].(map[string]any)["published_commit"])
			writeCourseAPIResult(t, w, map[string]any{"id": "course-1"})
		case r.Method == http.MethodPost && r.URL.Path == "/courses/course-1/lessons":
			writeCourseAPIResult(t, w, echoSubmittedName(t, r))
		case r.Method == http.MethodPost && r.URL.Path == "/courses/course-1/lessons/lesson-01/tasks":
			body := readCourseAPIRequest(t, r)
			require.Contains(t, body["content"], "任务契约")
			require.Len(t, body["subtasks"], 1)
			subtask := body["subtasks"].([]any)[0].(map[string]any)
			source := subtask["source"].(map[string]any)
			require.Contains(t, source["md"], "任务契约")
			require.NotContains(t, source, "path")
			writeCourseAPIResult(t, w, map[string]any{"id": body["name"]})
		case r.Method == http.MethodPost && r.URL.Path == "/courses/course-1/publish":
			published = true
			writeCourseAPIResult(t, w, map[string]any{
				"course_id":        "course-1",
				"published_commit": "commit-final",
			})
		case r.Method == http.MethodGet && r.URL.Path == "/courses/course-1":
			writeCourseAPIResult(t, w, courseDetail("course-1", published))
		case r.Method == http.MethodGet && r.URL.Path == "/courses/course-1/tasks":
			writeCourseAPIResult(t, w, singleLessonSummary())
		case r.Method == http.MethodGet && r.URL.Path == "/courses/course-1/outline":
			require.Equal(t, "json", r.URL.Query().Get("format"))
			require.Equal(t, "true", r.URL.Query().Get("include_content"))
			writeCourseAPIResult(t, w, courseOutline("course-1", packagedLearningMarkdown))
		default:
			http.Error(w, fmt.Sprintf("unexpected request: %s %s", r.Method, r.URL.RequestURI()), http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	workspace := t.TempDir()
	packagePath := writeCoursePackageFixture(t, workspace)
	actionLog := filepath.Join(filepath.Dir(packagePath), "api-actions.jsonl")
	script := filepath.Join("assets", "skills", "course-builder", "scripts", "course_package_cli.py")
	command := exec.Command(
		"python3",
		script,
		"publish",
		"--file", packagePath,
		"--workspace-root", workspace,
		"--base-url", server.URL,
		"--actions-log", actionLog,
	)
	command.Env = append(os.Environ(), "ZHIYONG_PLATFORM_API_KEY=teacher-token")
	output, err := command.CombinedOutput()
	require.NoError(t, err, string(output))

	publishedRaw, err := os.ReadFile(packagePath)
	require.NoError(t, err)
	var publishedPackage map[string]any
	require.NoError(t, json.Unmarshal(publishedRaw, &publishedPackage))
	publication := publishedPackage["publication"].(map[string]any)
	require.Equal(t, "published", publication["status"])
	require.Equal(t, "course-1", publication["courseId"])
	require.Equal(t, "commit-final", publication["publishedCommit"])

	actionRaw, err := os.ReadFile(actionLog)
	require.NoError(t, err)
	require.NotContains(t, string(actionRaw), "teacher-token")
	require.NotContains(t, strings.ToLower(string(actionRaw)), "authorization")
	require.Equal(t, []string{
		"GET /columns",
		"POST /courses/git-source",
		"POST /courses",
		"POST /courses/course-1/lessons",
		"POST /courses/course-1/lessons/lesson-01/tasks",
		"GET /courses/course-1",
		"GET /courses/course-1/outline?format=json&include_content=true",
		"GET /courses/course-1/tasks",
		"POST /courses/course-1/publish",
		"GET /courses/course-1",
		"GET /courses/course-1/outline?format=json&include_content=true",
		"GET /courses/course-1/tasks",
	}, requests)
}

func TestCoursePackageCLIRejectsWrongMarkdownReadback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/columns":
			writeCourseAPIResult(t, w, []map[string]any{
				{"id": "column-ai", "name": "人工智能", "code": "ai"},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/courses/git-source":
			writeCourseAPIResult(t, w, map[string]any{
				"git_source": map[string]any{
					"repo_owner":       "course",
					"repo_name":        "agent-course",
					"repo_ref":         "main",
					"repo_subpath":     ".",
					"manifest_path":    "course.yaml",
					"published_commit": "commit-init",
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/courses":
			writeCourseAPIResult(t, w, map[string]any{"id": "course-wrong-content"})
		case r.Method == http.MethodPost && r.URL.Path == "/courses/course-wrong-content/lessons":
			writeCourseAPIResult(t, w, echoSubmittedName(t, r))
		case r.Method == http.MethodPost && r.URL.Path == "/courses/course-wrong-content/lessons/lesson-01/tasks":
			writeCourseAPIResult(t, w, echoSubmittedName(t, r))
		case r.Method == http.MethodPost && r.URL.Path == "/courses/course-wrong-content/publish":
			writeCourseAPIResult(t, w, map[string]any{"published_commit": "commit-final"})
		case r.Method == http.MethodGet && r.URL.Path == "/courses/course-wrong-content":
			writeCourseAPIResult(t, w, courseDetail("course-wrong-content", false))
		case r.Method == http.MethodGet && r.URL.Path == "/courses/course-wrong-content/tasks":
			writeCourseAPIResult(t, w, singleLessonSummary())
		case r.Method == http.MethodGet && r.URL.Path == "/courses/course-wrong-content/outline":
			writeCourseAPIResult(t, w, courseOutline(
				"course-wrong-content",
				"# 错误内容\n\n这不是课程包中的学习讲义。\n",
			))
		default:
			http.Error(w, "unexpected request", http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	workspace := t.TempDir()
	packagePath := writeCoursePackageFixture(t, workspace)
	command := exec.Command(
		"python3",
		filepath.Join("assets", "skills", "course-builder", "scripts", "course_package_cli.py"),
		"publish",
		"--file", packagePath,
		"--workspace-root", workspace,
		"--base-url", server.URL,
	)
	command.Env = append(os.Environ(), "ZHIYONG_PLATFORM_API_KEY=teacher-token")
	output, err := command.CombinedOutput()
	require.Error(t, err)
	require.Contains(t, string(output), "course outline subtask source mismatch")
}

func TestCoursePackageCLIRecordsPartialCourseWhenPublishFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer teacher-token", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/columns":
			writeCourseAPIResult(t, w, []map[string]any{
				{"id": "column-ai", "name": "人工智能", "code": "ai"},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/courses/git-source":
			writeCourseAPIResult(t, w, map[string]any{
				"git_source": map[string]any{
					"repo_owner":       "course",
					"repo_name":        "agent-course",
					"repo_ref":         "main",
					"repo_subpath":     ".",
					"manifest_path":    "course.yaml",
					"published_commit": "commit-init",
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/courses":
			writeCourseAPIResult(t, w, map[string]any{"id": "course-partial"})
		case r.Method == http.MethodPost && r.URL.Path == "/courses/course-partial/lessons":
			http.Error(w, "lesson write failed", http.StatusBadGateway)
		default:
			http.Error(w, "unexpected request", http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	workspace := t.TempDir()
	packagePath := writeCoursePackageFixture(t, workspace)
	actionLog := filepath.Join(filepath.Dir(packagePath), "api-actions.jsonl")
	command := exec.Command(
		"python3",
		filepath.Join("assets", "skills", "course-builder", "scripts", "course_package_cli.py"),
		"publish",
		"--file", packagePath,
		"--workspace-root", workspace,
		"--base-url", server.URL,
		"--actions-log", actionLog,
	)
	command.Env = append(os.Environ(), "ZHIYONG_PLATFORM_API_KEY=teacher-token")
	output, err := command.CombinedOutput()
	require.Error(t, err)
	require.Contains(t, string(output), "lesson write failed")

	failedRaw, err := os.ReadFile(packagePath)
	require.NoError(t, err)
	var failedPackage map[string]any
	require.NoError(t, json.Unmarshal(failedRaw, &failedPackage))
	publication := failedPackage["publication"].(map[string]any)
	require.Equal(t, "failed", publication["status"])
	require.Equal(t, "course-partial", publication["partialCourseId"])
	require.NotEmpty(t, publication["failedAt"])

	actionRaw, err := os.ReadFile(actionLog)
	require.NoError(t, err)
	require.Contains(t, string(actionRaw), `"purpose": "publish_failed"`)
	require.NotContains(t, string(actionRaw), "teacher-token")
}

func TestCoursePackageCLISummaryRequiresAndUsesWorkspaceRoot(t *testing.T) {
	workspace := t.TempDir()
	packagePath := writeCoursePackageFixture(t, workspace)
	script := filepath.Join("assets", "skills", "course-builder", "scripts", "course_package_cli.py")

	withoutRoot := exec.Command("python3", script, "summary", "--file", packagePath)
	output, err := withoutRoot.CombinedOutput()
	require.Error(t, err)
	require.Contains(t, string(output), "--workspace-root")

	withRoot := exec.Command(
		"python3",
		script,
		"summary",
		"--file", packagePath,
		"--workspace-root", workspace,
	)
	output, err = withRoot.CombinedOutput()
	require.NoError(t, err, string(output))

	var summary map[string]any
	require.NoError(t, json.Unmarshal(output, &summary))
	require.Equal(t, true, summary["valid"])
	require.Equal(t, float64(1), summary["lessons"])
	require.Equal(t, float64(1), summary["tasks"])
}

func writeCoursePackageFixture(t *testing.T, workspace string) string {
	t.Helper()
	contentPath := filepath.Join(workspace, "output", "projects", "agent-course", "artifacts", "learning", "task-01.md")
	require.NoError(t, os.MkdirAll(filepath.Dir(contentPath), 0o755))
	require.NoError(t, os.WriteFile(contentPath, []byte("# 学习讲义\n\n写出可验收的任务契约。\n"), 0o644))

	packagePath := filepath.Join(workspace, "output", "projects", "agent-course", "artifacts", "course-package.json")
	require.NoError(t, os.MkdirAll(filepath.Dir(packagePath), 0o755))
	packageDocument := map[string]any{
		"schemaVersion": "zhiyong.course-package/v1",
		"projectId":     "agent-course",
		"course": map[string]any{
			"title":          "Agent 工程实践",
			"description":    "从任务契约到可验收交付",
			"type":           "practice",
			"columnSelector": "人工智能",
			"lessons": []map[string]any{
				{
					"id": "lesson-01", "title": "从需求到任务契约", "description": "",
					"status": 1, "sort": 1,
					"tasks": []map[string]any{
						{
							"id": "task-01", "title": "写出任务契约",
							"contentPath": "output/projects/agent-course/artifacts/learning/task-01.md",
							"type":        "learning", "duration": 45, "status": 1, "sort": 1,
							"subtasks": []map[string]any{
								{
									"id": "learning-file", "title": "学习讲义", "category": "study",
									"type": "markdown", "duration": 10, "completed": false,
									"status": 1, "sort": 1,
									"source": map[string]any{
										"path": "output/projects/agent-course/artifacts/learning/task-01.md",
									},
								},
							},
						},
					},
				},
			},
		},
		"publication": map[string]any{"requested": true, "status": "pending_credentials"},
	}
	rawPackage, err := json.MarshalIndent(packageDocument, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(packagePath, append(rawPackage, '\n'), 0o644))
	return packagePath
}

const packagedLearningMarkdown = "# 学习讲义\n\n写出可验收的任务契约。\n"

// courseOutline echoes every field writeCoursePackageFixture declares, because
// the CLI treats any divergence between package and readback as a failed
// publish. subtaskMarkdown is the only knob so a test can inject drift.
func courseOutline(courseID string, subtaskMarkdown string) map[string]any {
	return map[string]any{
		"id": courseID,
		"lessons": []map[string]any{
			{
				"id": "lesson-01", "title": "从需求到任务契约",
				"status": 1, "sort": 1,
				"tasks": []map[string]any{
					{
						"id": "task-01", "title": "写出任务契约",
						"content": packagedLearningMarkdown,
						"type":    "learning", "duration": 45,
						"status": 1, "sort": 1,
						"subtasks": []map[string]any{
							{
								"id": "learning-file", "title": "学习讲义",
								"category": "study", "type": "markdown",
								"duration": 10, "completed": false,
								"status": 1, "sort": 1,
								"source": map[string]any{"md": subtaskMarkdown},
							},
						},
					},
				},
			},
		},
	}
}

// courseDetail mirrors the draft/published split the CLI gates on: status 0
// until publish, then status 1 with resolved_commit matching the publish
// response so the readback poll converges.
func courseDetail(courseID string, published bool) map[string]any {
	detail := map[string]any{
		"id":     courseID,
		"status": 0,
		"git_source": map[string]any{
			"repo_owner":       "course",
			"repo_name":        "agent-course",
			"repo_ref":         "main",
			"published_commit": "commit-init",
		},
		"resolved_commit": "commit-init",
	}
	if published {
		detail["status"] = 1
		detail["resolved_commit"] = "commit-final"
		detail["git_source"].(map[string]any)["published_commit"] = "commit-final"
	}
	return detail
}

func singleLessonSummary() []map[string]any {
	return []map[string]any{
		{
			"id": "lesson-01", "title": "从需求到任务契约", "description": "",
			"tasks": []map[string]any{
				{
					"id": "task-01", "title": "写出任务契约",
					"subtasks": []map[string]any{
						{"id": "learning-file", "title": "学习讲义"},
					},
				},
			},
		},
	}
}

// echoSubmittedName mirrors course-api: a caller-supplied `name` becomes the
// manifest id verbatim, so the returned id is never a server-minted key.
func echoSubmittedName(t *testing.T, r *http.Request) map[string]any {
	t.Helper()
	body := readCourseAPIRequest(t, r)
	name, ok := body["name"].(string)
	require.True(t, ok, "course-api callers must submit a stable name")
	return map[string]any{"id": name}
}

func readCourseAPIRequest(t *testing.T, r *http.Request) map[string]any {
	t.Helper()
	var body map[string]any
	require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
	return body
}

func writeCourseAPIResult(t *testing.T, w http.ResponseWriter, data any) {
	t.Helper()
	require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
		"code": 0,
		"data": data,
	}))
}
