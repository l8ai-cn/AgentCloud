package v1

import (
	"github.com/gin-gonic/gin"

	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

func podWorkspaceChangesWire(changes []*runnerv1.SandboxFsChange) gin.H {
	data := make([]gin.H, 0, len(changes))
	for _, change := range changes {
		data = append(data, gin.H{
			"path":        change.GetPath(),
			"name":        change.GetName(),
			"status":      change.GetStatus(),
			"bytes":       nullablePodWorkspaceInt(change.GetBytes()),
			"modified_at": nullablePodWorkspaceInt(change.GetModifiedAt()),
		})
	}
	return gin.H{"object": "list", "data": data, "has_more": false}
}

func podWorkspaceListWire(entries []*runnerv1.SandboxFsEntry, workspaceRoot string) gin.H {
	data := make([]gin.H, 0, len(entries))
	for _, entry := range entries {
		data = append(data, gin.H{
			"id":          entry.GetPath(),
			"name":        entry.GetName(),
			"path":        entry.GetPath(),
			"type":        entry.GetType(),
			"bytes":       nullablePodWorkspaceInt(entry.GetBytes()),
			"modified_at": nullablePodWorkspaceInt(entry.GetModifiedAt()),
		})
	}
	out := gin.H{"object": "list", "data": data, "has_more": false}
	if workspaceRoot != "" {
		out["workspace_root"] = workspaceRoot
	}
	return out
}

func podWorkspaceFileWire(path string, result *runnerv1.SandboxFsResultEvent) gin.H {
	encoding := result.GetEncoding()
	if encoding == "" {
		encoding = "utf-8"
	}
	return gin.H{
		"object":       "pod.workspace.file_content",
		"path":         path,
		"content_type": result.GetContentType(),
		"encoding":     encoding,
		"content":      result.GetContent(),
		"bytes":        result.GetFileBytes(),
		"truncated":    result.GetTruncated(),
	}
}

func nullablePodWorkspaceInt(value int64) any {
	if value == 0 {
		return nil
	}
	return value
}
