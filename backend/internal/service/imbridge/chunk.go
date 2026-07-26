package imbridge

import (
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func textLimitForProvider(provider string) int {
	switch provider {
	case domain.ProviderDingTalk:
		return 3800
	case domain.ProviderFeishu:
		return 8000
	case domain.ProviderWeCom:
		return 2000
	default:
		return 3500
	}
}

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
			// LastIndex is a byte offset; compare in runes so CJK text does not
			// break at a far earlier newline than the limit intends.
			if cut := strings.LastIndex(string(runes[:n]), "\n"); cut > 0 {
				if head := []rune(string(runes[:n])[:cut]); len(head) > limit/2 {
					n = len(head)
				}
			}
		}
		out = append(out, string(runes[:n]))
		runes = runes[n:]
	}
	return out
}
