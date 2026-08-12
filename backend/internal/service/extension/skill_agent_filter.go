package extension

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"strings"

	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
)

func packedAgentFilterKey(storageKey string) string {
	return storageKey + ".agent-filter.json"
}

func marshalPackedAgentFilter(filter []string) []byte {
	if len(filter) == 0 {
		return nil
	}
	raw, err := json.Marshal(filter)
	if err != nil {
		return nil
	}
	return raw
}

func agentFilterFromFrontmatter(fm map[string]string) []string {
	for _, key := range []string{"agent-filter", "agents", "compatibility"} {
		if parsed := splitAgentFilter(fm[key]); len(parsed) > 0 {
			return parsed
		}
	}
	return nil
}

func splitAgentFilter(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	if strings.HasPrefix(raw, "[") {
		var items []string
		if err := json.Unmarshal([]byte(raw), &items); err == nil {
			return nonEmptyAgentSlugs(items)
		}
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ' ' || r == ';'
	})
	return nonEmptyAgentSlugs(parts)
}

func nonEmptyAgentSlugs(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(strings.Trim(value, `"'`)); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func installedSkillAgentFilter(skill *extension.InstalledSkill) []string {
	if skill == nil {
		return nil
	}
	if skill.Skill != nil {
		return skill.Skill.GetAgentFilter()
	}
	if len(skill.AgentFilter) == 0 {
		return nil
	}
	var filter []string
	if err := json.Unmarshal(skill.AgentFilter, &filter); err != nil {
		return nil
	}
	return filter
}

func filterSkillsByAgent(skills []*extension.InstalledSkill, agentSlug string) []*extension.InstalledSkill {
	if agentSlug == "" {
		return skills
	}
	result := make([]*extension.InstalledSkill, 0, len(skills))
	for _, skill := range skills {
		if installedSkillAllowsAgent(skill, agentSlug) {
			result = append(result, skill)
		}
	}
	return result
}

func installedSkillAllowsAgent(skill *extension.InstalledSkill, agentSlug string) bool {
	filter := installedSkillAgentFilter(skill)
	if len(filter) == 0 {
		return true
	}
	for _, allowed := range filter {
		if agentSlugMatches(allowed, agentSlug) {
			return true
		}
	}
	return false
}

func agentSlugMatches(filterValue, actual string) bool {
	if filterValue == actual {
		return true
	}
	aliases := map[string][]string{
		"codex-cli":   {"codex"},
		"codex":       {"codex-cli"},
		"claude-code": {"claude"},
		"claude":      {"claude-code"},
		"gemini-cli":  {"gemini"},
		"gemini":      {"gemini-cli"},
	}
	for _, alias := range aliases[actual] {
		if filterValue == alias {
			return true
		}
	}
	return false
}

func (s *Service) hydratePackedAgentFilters(ctx context.Context, skills []*extension.InstalledSkill) {
	if s == nil || s.storage == nil {
		return
	}
	for _, skill := range skills {
		if skill == nil || skill.Skill != nil || len(skill.AgentFilter) > 0 || skill.StorageKey == "" {
			continue
		}
		raw, err := s.loadPackedAgentFilter(ctx, skill.StorageKey)
		if err != nil {
			slog.WarnContext(ctx, "failed to load packed skill agent filter",
				"slug", skill.Slug, "storage_key", skill.StorageKey, "error", err)
			continue
		}
		skill.AgentFilter = raw
	}
}

func (s *Service) loadPackedAgentFilter(ctx context.Context, storageKey string) (json.RawMessage, error) {
	key := packedAgentFilterKey(storageKey)
	exists, err := s.storage.Exists(ctx, key)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, nil
	}
	body, _, err := s.storage.Download(ctx, key)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	raw, err := io.ReadAll(io.LimitReader(body, 8*1024))
	if err != nil {
		return nil, err
	}
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return nil, nil
	}
	var filter []string
	if err := json.Unmarshal(raw, &filter); err != nil {
		return nil, err
	}
	return raw, nil
}
