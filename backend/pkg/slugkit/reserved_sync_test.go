package slugkit

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"testing"
)

// TestReservedListSyncAcrossSources ensures the backend reserved list stays
// in lock-step with two sibling hardcoded sources:
//
//   - clients/web/src/lib/slug/reserved.ts  (frontend Validate)
//   - backend/schema/schema.sql organizations_slug_not_reserved CHECK
//
// Drift causes user-facing bugs: a slug allowed by one tier and blocked by
// another. Adding/removing a reserved word means editing all three sources.
//
// Set SLUGKIT_SKIP_FRONTEND_SYNC_CHECK=1 to opt out in environments that
// genuinely cannot see them (e.g. backend-only image builds).
func TestReservedListSyncAcrossSources(t *testing.T) {
	if os.Getenv("SLUGKIT_SKIP_FRONTEND_SYNC_CHECK") == "1" {
		t.Skip("cross-source sync check disabled by SLUGKIT_SKIP_FRONTEND_SYNC_CHECK=1")
	}

	repoRoot, err := findRepoRoot()
	if err != nil {
		t.Fatalf("could not locate repo root (set SLUGKIT_SKIP_FRONTEND_SYNC_CHECK=1 to bypass): %v", err)
	}

	tsSet := readReservedFromFile(t, filepath.Join(repoRoot, "clients", "web", "src", "lib", "slug", "reserved.ts"), `"([a-z0-9-]+)"`)
	sqlSet := readReservedFromSchema(t, filepath.Join(repoRoot, "backend", "schema", "schema.sql"))

	goSet := make(map[string]bool, len(reserved))
	for k := range reserved {
		goSet[k] = true
	}

	assertSetsEqual(t, "go", goSet, "ts", tsSet)
	assertSetsEqual(t, "go", goSet, "sql", sqlSet)
}

func readReservedFromFile(t *testing.T, path, pattern string) map[string]bool {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read %s: %v", path, err)
	}
	out := extractReservedSet(string(data), pattern)
	if len(out) == 0 {
		t.Fatalf("no reserved entries parsed from %s (pattern=%s)", path, pattern)
	}
	return out
}

func extractReservedSet(src, pattern string) map[string]bool {
	re := regexp.MustCompile(pattern)
	matches := re.FindAllStringSubmatch(src, -1)
	out := make(map[string]bool, len(matches))
	for _, m := range matches {
		out[m[1]] = true
	}
	return out
}

func assertSetsEqual(t *testing.T, leftName string, left map[string]bool, rightName string, right map[string]bool) {
	t.Helper()
	for word := range left {
		if !right[word] {
			t.Errorf("%s reserved %q is missing from %s", leftName, word, rightName)
		}
	}
	for word := range right {
		if !left[word] {
			t.Errorf("%s reserved %q is missing from %s", rightName, word, leftName)
		}
	}
}

// findRepoRoot resolves the workspace root in three modes:
//
//  1. Bazel test sandbox: the go_test target wires `clients/web/...` and
//     schema DDL in via `data`. Their materialized parent
//     is `$TEST_SRCDIR/_main/`.
//  2. Bazel `bazel run` / interactive: `BUILD_WORKSPACE_DIRECTORY` points
//     at the live source tree.
//  3. Plain `go test ./...` from anywhere inside the repo: walk up from
//     cwd looking for go.work + clients/ as the marker.
func findRepoRoot() (string, error) {
	if root := os.Getenv("BUILD_WORKSPACE_DIRECTORY"); root != "" {
		return root, nil
	}
	if srcdir := os.Getenv("TEST_SRCDIR"); srcdir != "" {
		root := filepath.Join(srcdir, "_main")
		if _, err := os.Stat(filepath.Join(root, "clients", "web", "src", "lib", "slug", "reserved.ts")); err == nil {
			return root, nil
		}
	}

	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := cwd
	for i := 0; i < 8; i++ {
		hasClients := false
		if _, err := os.Stat(filepath.Join(dir, "clients", "web")); err == nil {
			hasClients = true
		}
		_, errGoMod := os.Stat(filepath.Join(dir, "go.mod"))
		_, errGoWork := os.Stat(filepath.Join(dir, "go.work"))
		if hasClients && (errGoMod == nil || errGoWork == nil) {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", os.ErrNotExist
}

func readReservedFromSchema(t *testing.T, schemaPath string) map[string]bool {
	t.Helper()
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		t.Fatalf("failed to read %s: %v", schemaPath, err)
	}
	re := regexp.MustCompile(
		`ADD CONSTRAINT organizations_slug_not_reserved CHECK \(\(\(slug\)::text <> ALL \(\(ARRAY\[([^\]]+)\]`,
	)
	match := re.FindStringSubmatch(string(data))
	if match == nil {
		t.Fatalf("organizations_slug_not_reserved CHECK not found in %s", schemaPath)
	}
	out := extractReservedSet(match[1], `'([a-z0-9-]+)'`)
	if len(out) == 0 {
		t.Fatalf("no reserved entries parsed from organizations_slug_not_reserved in %s", schemaPath)
	}
	return out
}

// TestReservedListIsSorted ensures the canonical list is deterministic so
// drift diffs stay readable.
func TestReservedListIsSorted(t *testing.T) {
	list := ReservedList()
	sort.Strings(list)
	for i := 1; i < len(list); i++ {
		if list[i] == list[i-1] {
			t.Errorf("duplicate entry: %q", list[i])
		}
	}
}
