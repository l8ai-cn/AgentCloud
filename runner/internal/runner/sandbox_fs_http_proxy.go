package runner

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	runnerv1 "github.com/l8ai-cn/agentcloud/proto/gen/go/runner/v1"
)

const (
	maxInterfaceHTTPProxyBody = 8 << 20
	interfaceSocketRelDir     = ".agent/run"
)

type sandboxHTTPProxyRequest struct {
	Method  string              `json:"method"`
	Path    string              `json:"path"`
	Query   string              `json:"query"`
	Headers map[string][]string `json:"headers"`
	BodyB64 string              `json:"body_b64"`
}

type sandboxHTTPProxyResponse struct {
	Status  int                 `json:"status"`
	Headers map[string][]string `json:"headers"`
	BodyB64 string              `json:"body_b64"`
}

func (h *RunnerMessageHandler) sandboxFsHTTPProxyWorkspace(
	workspace *sandboxWorkspace,
	interfaceID, payload string,
) (*runnerv1.SandboxFsResultEvent, error) {
	id, err := normalizeInterfaceID(interfaceID)
	if err != nil {
		return fsErrResult(err.Error()), nil
	}
	var req sandboxHTTPProxyRequest
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		return fsErrResult("invalid http_proxy payload"), nil
	}
	method := strings.ToUpper(strings.TrimSpace(req.Method))
	if method == "" {
		method = http.MethodGet
	}
	urlPath, err := normalizeInterfaceURLPath(req.Path)
	if err != nil {
		return fsErrResult(err.Error()), nil
	}
	socketPath := filepath.Join(workspace.displayPath(), interfaceSocketRelDir, id+".sock")
	if _, err := os.Stat(socketPath); err != nil {
		if os.IsNotExist(err) {
			return fsErrResult("interface socket not found"), nil
		}
		return fsErrResult(err.Error()), nil
	}
	var body []byte
	if req.BodyB64 != "" {
		decoded, decodeErr := base64.StdEncoding.DecodeString(req.BodyB64)
		if decodeErr != nil {
			return fsErrResult("invalid body_b64"), nil
		}
		if len(decoded) > maxInterfaceHTTPProxyBody {
			return fsErrResult("request body exceeds maximum size"), nil
		}
		body = decoded
	}
	target := "http://unix" + urlPath
	if q := strings.TrimSpace(req.Query); q != "" {
		target += "?" + strings.TrimPrefix(q, "?")
	}
	httpReq, err := http.NewRequestWithContext(
		context.Background(),
		method,
		target,
		bytes.NewReader(body),
	)
	if err != nil {
		return fsErrResult(err.Error()), nil
	}
	for key, values := range req.Headers {
		for _, value := range values {
			httpReq.Header.Add(key, value)
		}
	}
	client := &http.Client{
		Timeout: 25 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var dialer net.Dialer
				return dialer.DialContext(ctx, "unix", socketPath)
			},
		},
	}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fsErrResult(fmt.Sprintf("interface proxy failed: %v", err)), nil
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxInterfaceHTTPProxyBody+1))
	if err != nil {
		return fsErrResult(err.Error()), nil
	}
	if len(respBody) > maxInterfaceHTTPProxyBody {
		return fsErrResult("response body exceeds maximum size"), nil
	}
	encoded, err := json.Marshal(sandboxHTTPProxyResponse{
		Status:  resp.StatusCode,
		Headers: resp.Header,
		BodyB64: base64.StdEncoding.EncodeToString(respBody),
	})
	if err != nil {
		return fsErrResult(err.Error()), nil
	}
	return &runnerv1.SandboxFsResultEvent{
		Content:  string(encoded),
		Encoding: "http_proxy_v1",
	}, nil
}

func (h *RunnerMessageHandler) sandboxFsListInterfacesWorkspace(
	workspace *sandboxWorkspace,
) (*runnerv1.SandboxFsResultEvent, error) {
	dir := filepath.Join(workspace.displayPath(), interfaceSocketRelDir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return &runnerv1.SandboxFsResultEvent{Entries: nil}, nil
		}
		return fsErrResult(err.Error()), nil
	}
	out := make([]*runnerv1.SandboxFsEntry, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".sock") {
			continue
		}
		id := strings.TrimSuffix(name, ".sock")
		if _, err := normalizeInterfaceID(id); err != nil {
			continue
		}
		info, statErr := entry.Info()
		modified := int64(0)
		if statErr == nil {
			modified = info.ModTime().Unix()
		}
		out = append(out, &runnerv1.SandboxFsEntry{
			Path:       id,
			Name:       id,
			Type:       "interface",
			ModifiedAt: modified,
		})
	}
	return &runnerv1.SandboxFsResultEvent{Entries: out}, nil
}

func normalizeInterfaceID(raw string) (string, error) {
	id := strings.TrimSpace(raw)
	if id == "" || strings.Contains(id, "/") || strings.Contains(id, `\`) ||
		strings.Contains(id, "..") {
		return "", fmt.Errorf("invalid interface id")
	}
	for _, r := range id {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-'
		if !ok {
			return "", fmt.Errorf("invalid interface id")
		}
	}
	if len(id) < 2 || len(id) > 100 {
		return "", fmt.Errorf("invalid interface id")
	}
	return id, nil
}

func normalizeInterfaceURLPath(raw string) (string, error) {
	path := strings.TrimSpace(raw)
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if strings.Contains(path, "..") || strings.Contains(path, `\`) {
		return "", fmt.Errorf("invalid interface path")
	}
	return path, nil
}
