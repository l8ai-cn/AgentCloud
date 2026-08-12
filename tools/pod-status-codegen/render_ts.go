package main

import (
	"fmt"
	"strings"
)

func renderTS(statuses []status) string {
	var b strings.Builder
	fmt.Fprintf(&b, "// %s\n\nexport type PodStatus =\n", header)
	for i, s := range statuses {
		terminator := ""
		if i == len(statuses)-1 {
			terminator = ";"
		}
		fmt.Fprintf(&b, "  | %q%s\n", s.wire, terminator)
	}

	tsArray(&b, "POD_STATUSES", statuses)
	for _, group := range groupSpecs() {
		members := filter(statuses, group.member)
		tsArray(&b, strings.ToUpper(group.name)+"_POD_STATUSES", members)
	}
	for _, group := range groupSpecs() {
		tsPredicate(&b, group.name)
	}
	return b.String()
}

func tsArray(b *strings.Builder, name string, members []status) {
	values := make([]string, 0, len(members))
	for _, s := range members {
		values = append(values, fmt.Sprintf("%q", s.wire))
	}
	fmt.Fprintf(b, "\nexport const %s: readonly PodStatus[] = [%s];\n", name, strings.Join(values, ", "))
}

func tsPredicate(b *strings.Builder, group string) {
	set := lowerCamel(group) + "Statuses"
	fmt.Fprintf(
		b,
		"\nconst %s: ReadonlySet<string> = new Set(%s_POD_STATUSES);\nexport function isPod%s(status: string | null | undefined): boolean {\n  return !!status && %s.has(status);\n}\n",
		set,
		strings.ToUpper(group),
		camel(group),
		set,
	)
}

func lowerCamel(snake string) string {
	name := camel(snake)
	return strings.ToLower(name[:1]) + name[1:]
}
