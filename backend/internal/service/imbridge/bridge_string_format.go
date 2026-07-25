package imbridge

import "strings"

func strPtr(s string) *string { return &s }

func strPtrIf(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func sanitizeName(s string) string {
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return '-'
	}, s)
	if len(s) > 40 {
		s = s[:40]
	}
	return strings.Trim(s, "-")
}
