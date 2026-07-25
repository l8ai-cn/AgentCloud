package imbridge

import (
	"fmt"
	"regexp"
	"strings"

	channelDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/channel"
)

// slugMentionRe matches @identifier tokens that can address workers (slugkit shape).
var slugMentionRe = regexp.MustCompile(`@([a-z0-9]+(?:-[a-z0-9]+)*)`)

func composeInboundContent(label, text string) channelDomain.MessageContent {
	prefix := ""
	if strings.TrimSpace(label) != "" {
		prefix = fmt.Sprintf("[%s] ", label)
	}
	body := prefix + text
	elements := parseMentionElements(body)
	return channelDomain.MessageContent{
		SchemaVersion: 1,
		Kind:          "text",
		Blocks: []channelDomain.Block{{
			Type:     "paragraph",
			Elements: elements,
		}},
	}
}

func parseMentionElements(text string) []channelDomain.InlineElement {
	matches := slugMentionRe.FindAllStringSubmatchIndex(text, -1)
	if len(matches) == 0 {
		return []channelDomain.InlineElement{{Type: channelDomain.InlineText, Text: text}}
	}
	var elements []channelDomain.InlineElement
	cursor := 0
	for _, m := range matches {
		if m[0] > cursor {
			elements = append(elements, channelDomain.InlineElement{
				Type: channelDomain.InlineText,
				Text: text[cursor:m[0]],
			})
		}
		key := text[m[2]:m[3]]
		elements = append(elements, channelDomain.InlineElement{
			Type:       channelDomain.InlineMention,
			EntityType: channelDomain.EntityPod,
			EntityKey:  key,
			Display:    "@" + key,
		})
		cursor = m[1]
	}
	if cursor < len(text) {
		elements = append(elements, channelDomain.InlineElement{
			Type: channelDomain.InlineText,
			Text: text[cursor:],
		})
	}
	return elements
}
