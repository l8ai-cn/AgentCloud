package runner

import (
	"encoding/json"
	"strings"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
)

func isDetachedDoAgentCommand(agent string, req acp.PermissionRequest) bool {
	if agent != "do-agent" || req.ArgumentsJSON == "" {
		return false
	}
	var input any
	if json.Unmarshal([]byte(req.ArgumentsJSON), &input) != nil {
		return false
	}
	return containsDetachedShellCommand(input)
}

func containsDetachedShellCommand(value any) bool {
	switch item := value.(type) {
	case map[string]any:
		for key, child := range item {
			if isShellInputKey(key) && isDetachedShellValue(child) {
				return true
			}
			switch child.(type) {
			case map[string]any, []any:
				if containsDetachedShellCommand(child) {
					return true
				}
			}
		}
	case []any:
		for _, child := range item {
			if containsDetachedShellCommand(child) {
				return true
			}
		}
	}
	return false
}

func isDetachedShellValue(value any) bool {
	switch item := value.(type) {
	case string:
		return isDetachedShellText(item)
	case []any:
		for _, child := range item {
			if isDetachedShellValue(child) {
				return true
			}
		}
	}
	return false
}

func isShellInputKey(key string) bool {
	switch strings.ToLower(key) {
	case "command", "cmd", "script", "shell":
		return true
	default:
		return false
	}
}

func isDetachedShellText(command string) bool {
	fields := strings.Fields(command)
	for _, field := range fields {
		switch field {
		case "nohup", "disown", "setsid":
			return true
		}
	}
	var singleQuote, doubleQuote, escaped bool
	for i := 0; i < len(command); i++ {
		ch := command[i]
		if escaped {
			escaped = false
			continue
		}
		if ch == '\\' && !singleQuote {
			escaped = true
			continue
		}
		if ch == '\'' && !doubleQuote {
			singleQuote = !singleQuote
			continue
		}
		if ch == '"' && !singleQuote {
			doubleQuote = !doubleQuote
			continue
		}
		if ch == '&' && !singleQuote && !doubleQuote {
			leftAmpersand := i > 0 && command[i-1] == '&'
			rightAmpersand := i+1 < len(command) && command[i+1] == '&'
			redirection := i+1 < len(command) && command[i+1] == '>'
			if !leftAmpersand && !rightAmpersand && !redirection {
				return true
			}
		}
	}
	return false
}
