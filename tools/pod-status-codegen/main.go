// pod-status-codegen emits the pod lifecycle status vocabulary and its
// classification predicates for every runtime that needs them, from the
// annotations on proto.pod.v1.PodStatus.
//
// Why generated instead of hand-written per language: the Go domain, the Rust
// client cache and the TS contract layer all have to agree on which statuses
// count as active / finished / relay-connectable / wakeable. Three hand-kept
// copies drifted (a phantom "failed" status in the clients, a missing "queued"
// in the TS union) and produced user-visible bugs — a woken Worker vanished
// from the sidebar, and orphaned Workers could never be woken at all.
//
// Run via `pnpm proto:gen-all` (scripts/proto-gen-all.sh). Requires
// proto/gen/go to exist (scripts/proto-gen-go.sh).
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

type target struct {
	path   string
	render func([]status) string
}

func main() {
	root := flag.String("root", ".", "workspace root the output paths resolve against")
	flag.Parse()

	statuses, err := loadStatuses()
	if err != nil {
		fail(err)
	}

	targets := []target{
		{filepath.Join("backend", "internal", "domain", "agentpod", "pod_status.gen.go"), renderGo},
		{filepath.Join("clients", "core", "crates", "state", "src", "pod_status.rs"), renderRust},
		{filepath.Join("packages", "service-interface", "src", "view-models", "pod-status.gen.ts"), renderTS},
	}
	for _, t := range targets {
		out := filepath.Join(*root, t.path)
		if err := os.WriteFile(out, []byte(t.render(statuses)), 0o644); err != nil {
			fail(err)
		}
		fmt.Printf("generated %s (%d statuses)\n", t.path, len(statuses))
	}
}

func fail(err error) {
	fmt.Fprintf(os.Stderr, "pod-status-codegen: %v\n", err)
	os.Exit(1)
}
