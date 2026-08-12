package main

import (
	"fmt"
	"go/format"
	"strings"
)

func renderGo(statuses []status) string {
	var b strings.Builder
	fmt.Fprintf(&b, "// %s\n\npackage agentpod\n\nconst (\n", header)
	for _, s := range statuses {
		fmt.Fprintf(&b, "\t%s = %q\n", s.goConst(), s.wire)
	}
	b.WriteString(")\n")

	goSliceFunc(&b, "AllStatuses", statuses)
	for _, group := range groupSpecs() {
		members := filter(statuses, group.member)
		goSliceFunc(&b, camel(group.name)+"Statuses", members)
		goPredicate(&b, "IsPodStatus"+camel(group.name), members)
	}
	formatted, err := format.Source([]byte(b.String()))
	if err != nil {
		fail(fmt.Errorf("generated Go is not parseable: %w", err))
	}
	return string(formatted)
}

func goSliceFunc(b *strings.Builder, name string, members []status) {
	fmt.Fprintf(b, "\nfunc %s() []string {\n\treturn []string{", name)
	for i, s := range members {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(s.goConst())
	}
	b.WriteString("}\n}\n")
}

func goPredicate(b *strings.Builder, name string, members []status) {
	fmt.Fprintf(b, "\nfunc %s(status string) bool {\n", name)
	if len(members) == 0 {
		b.WriteString("\treturn false\n}\n")
		return
	}
	b.WriteString("\tswitch status {\n\tcase ")
	for i, s := range members {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(s.goConst())
	}
	b.WriteString(":\n\t\treturn true\n\t}\n\treturn false\n}\n")
}
