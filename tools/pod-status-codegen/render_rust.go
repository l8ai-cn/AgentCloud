package main

import (
	"fmt"
	"strings"
)

func renderRust(statuses []status) string {
	var b strings.Builder
	fmt.Fprintf(&b, "//! %s\n\n", header)
	for _, s := range statuses {
		fmt.Fprintf(&b, "pub const %s: &str = %q;\n", s.rustConst(), s.wire)
	}

	rustSlice(&b, "ALL", statuses)
	for _, group := range groupSpecs() {
		members := filter(statuses, group.member)
		rustSlice(&b, strings.ToUpper(group.name), members)
		rustPredicate(&b, "is_"+group.name, members)
	}
	return b.String()
}

func rustSlice(b *strings.Builder, name string, members []status) {
	fmt.Fprintf(b, "\npub const %s: [&str; %d] = [", name, len(members))
	for i, s := range members {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(s.rustConst())
	}
	b.WriteString("];\n")
}

func rustPredicate(b *strings.Builder, name string, members []status) {
	if len(members) == 0 {
		fmt.Fprintf(b, "\npub fn %s(_status: &str) -> bool {\n    false\n}\n", name)
		return
	}
	patterns := make([]string, 0, len(members))
	for _, s := range members {
		patterns = append(patterns, s.rustConst())
	}
	fmt.Fprintf(
		b,
		"\npub fn %s(status: &str) -> bool {\n    matches!(status, %s)\n}\n",
		name,
		strings.Join(patterns, " | "),
	)
}
