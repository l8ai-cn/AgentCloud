package config

import (
	"testing"

	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/taskstore"
	"github.com/stretchr/testify/require"
)

func TestLoadRequiresAPIKey(t *testing.T) {
	t.Setenv("BROWSER_GATEWAY_API_KEY", "")
	_, err := Load()
	require.Error(t, err)
}

func TestLoadDefaults(t *testing.T) {
	t.Setenv("BROWSER_GATEWAY_API_KEY", "k")
	t.Setenv("BROWSER_GATEWAY_LISTEN", "")
	t.Setenv("BROWSER_GATEWAY_CONCURRENCY", "")
	t.Setenv("BROWSER_GATEWAY_DRIVER", "")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, ":8080", cfg.ListenAddr)
	require.Equal(t, 3, cfg.Concurrency)
	require.Equal(t, taskstore.DriverUnconfigured, cfg.Driver)
	require.Equal(t, "k", cfg.APIKey)
}

func TestLoadRejectsUnknownDriver(t *testing.T) {
	t.Setenv("BROWSER_GATEWAY_API_KEY", "k")
	t.Setenv("BROWSER_GATEWAY_DRIVER", "cdp")
	_, err := Load()
	require.Error(t, err)
}
