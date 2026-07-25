package imbridge

import "strings"

func chunkText(text string, limit int) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	if limit <= 0 || len([]rune(text)) <= limit {
		return []string{text}
	}
	runes := []rune(text)
	var out []string
	for len(runes) > 0 {
		n := limit
		if n > len(runes) {
			n = len(runes)
		}
		if n < len(runes) {
			if cut := strings.LastIndex(string(runes[:n]), "\n"); cut > limit/2 {
				n = len([]rune(string(runes[:n])[:cut]))
			}
		}
		out = append(out, string(runes[:n]))
		runes = runes[n:]
	}
	return out
}
