package workbench

import (
	"strings"

	agentworkbenchv2 "github.com/l8ai-cn/agentcloud/proto/gen/go/agent_workbench/v2"
)

type toolDescriptor struct {
	semanticKey string
	category    string
}

var commonTools = map[string]toolDescriptor{
	"Bash":                       {"shell.execute", "shell"},
	"shell":                      {"shell.execute", "shell"},
	"Read":                       {"filesystem.read", "filesystem"},
	"Write":                      {"filesystem.write", "filesystem"},
	"Edit":                       {"filesystem.edit", "filesystem"},
	"fileChange":                 {"filesystem.change", "filesystem"},
	"Grep":                       {"filesystem.search", "filesystem"},
	"grep":                       {"filesystem.search", "filesystem"},
	"Glob":                       {"filesystem.search", "filesystem"},
	"glob":                       {"filesystem.search", "filesystem"},
	"LS":                         {"filesystem.search", "filesystem"},
	"list_files":                 {"filesystem.search", "filesystem"},
	"WebFetch":                   {"web.fetch", "web"},
	"WebSearch":                  {"web.search", "web"},
	"AskUserQuestion":            {"interaction.question", "interaction"},
	"image_generation":           {"media.image.generate", "media"},
	"image_gen":                  {"media.image.generate", "media"},
	"web_search_call":            {"web.search", "web"},
	"file_search_call":           {"filesystem.search", "filesystem"},
	"computer_call":              {"computer.use", "computer"},
	"mcp_call":                   {"mcp.call", "mcp"},
	"mcp_list_tools":             {"mcp.list-tools", "mcp"},
	"code_interpreter_call":      {"code.interpret", "code"},
	"image_generation_call":      {"media.image.generate", "media"},
	"workbench.publish_artifact": {"artifact.publish", "artifact"},
	"TodoWrite":                  {"plan.todo", "plan"},
	"ExecuteCode":                {"code.interpret", "code"},
}

func resolveToolIdentity(
	sourceProtocol, toolName string,
) (*agentworkbenchv2.ToolIdentity, string) {
	name := strings.TrimSpace(toolName)
	descriptor, matched := lookupToolDescriptor(name)
	sourceName := name
	if matchedBase, ok := matchedBaseName(name); ok {
		sourceName = matchedBase
	}
	if !matched {
		descriptor = toolDescriptor{
			semanticKey: "tool.custom",
			category:    "custom",
		}
		sourceName = name
	}
	namespace := "agentcloud." + sourceProtocol
	if name == "workbench.publish_artifact" {
		namespace = "agentcloud.runner"
	}
	return &agentworkbenchv2.ToolIdentity{
		Namespace:      namespace,
		SemanticKey:    descriptor.semanticKey,
		SchemaVersion:  "1",
		SourceToolName: stringPointer(sourceName),
	}, descriptor.category
}

func lookupToolDescriptor(toolName string) (toolDescriptor, bool) {
	if descriptor, ok := commonTools[toolName]; ok {
		return descriptor, true
	}
	if base, ok := matchedBaseName(toolName); ok {
		if descriptor, ok := commonTools[base]; ok {
			return descriptor, true
		}
	}
	lower := strings.ToLower(toolName)
	for key, descriptor := range commonTools {
		if strings.ToLower(key) == lower {
			return descriptor, true
		}
	}
	if base, ok := matchedBaseName(toolName); ok {
		baseLower := strings.ToLower(base)
		for key, descriptor := range commonTools {
			if strings.ToLower(key) == baseLower {
				return descriptor, true
			}
		}
	}
	return toolDescriptor{}, false
}

// ACP titles often look like "Bash for i in {1..36}; do ...". Prefer the
// leading token when it matches a known tool name.
func matchedBaseName(toolName string) (string, bool) {
	fields := strings.Fields(toolName)
	if len(fields) < 2 {
		return "", false
	}
	return fields[0], true
}

func sourceProtocol(adapterID string) string {
	switch {
	case strings.HasPrefix(adapterID, "codex"):
		return "codex"
	case strings.HasPrefix(adapterID, "claude"):
		return "claude"
	default:
		return "acp"
	}
}
