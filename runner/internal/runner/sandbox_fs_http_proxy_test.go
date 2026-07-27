package runner

import (
	"encoding/base64"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSandboxFsHTTPProxyForwardsOverUnixSocket(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix sockets")
	}
	// Keep the socket path short — macOS AF_UNIX has a ~104 byte sun_path limit.
	root, err := os.MkdirTemp("/tmp", "lc-http-")
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.RemoveAll(root) })
	socketDir := filepath.Join(root, ".agent", "run")
	require.NoError(t, os.MkdirAll(socketDir, 0o755))
	socketPath := filepath.Join(socketDir, "learning-companion.sock")
	listener, err := net.Listen("unix", socketPath)
	require.NoError(t, err)
	defer listener.Close()
	go http.Serve(listener, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/workspace", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))

	workspace, err := openSandboxWorkspace(root)
	require.NoError(t, err)
	defer workspace.Close()
	payload, err := json.Marshal(sandboxHTTPProxyRequest{
		Method: "GET",
		Path:   "/workspace",
	})
	require.NoError(t, err)

	result, err := (&RunnerMessageHandler{}).sandboxFsHTTPProxyWorkspace(
		workspace, "learning-companion", string(payload),
	)
	require.NoError(t, err)
	require.Empty(t, result.Error)
	var resp sandboxHTTPProxyResponse
	require.NoError(t, json.Unmarshal([]byte(result.Content), &resp))
	require.Equal(t, 200, resp.Status)
	body, err := base64.StdEncoding.DecodeString(resp.BodyB64)
	require.NoError(t, err)
	require.JSONEq(t, `{"ok":true}`, string(body))
}

func TestSandboxFsHTTPProxyRejectsPathTraversal(t *testing.T) {
	workspace, err := openSandboxWorkspace(t.TempDir())
	require.NoError(t, err)
	defer workspace.Close()
	payload, err := json.Marshal(sandboxHTTPProxyRequest{
		Method: "GET",
		Path:   "/../etc/passwd",
	})
	require.NoError(t, err)
	result, err := (&RunnerMessageHandler{}).sandboxFsHTTPProxyWorkspace(
		workspace, "learning-companion", string(payload),
	)
	require.NoError(t, err)
	require.Contains(t, result.Error, "invalid interface path")
}

func TestNormalizeInterfaceID(t *testing.T) {
	_, err := normalizeInterfaceID("../evil")
	require.Error(t, err)
	id, err := normalizeInterfaceID("learning-companion")
	require.NoError(t, err)
	require.Equal(t, "learning-companion", id)
}
