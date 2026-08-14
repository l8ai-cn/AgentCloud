package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/taskstore"
)

type Config struct {
	ListenAddr  string
	APIKey      string
	Concurrency int
	Driver      taskstore.Driver
}

func Load() (Config, error) {
	key := strings.TrimSpace(os.Getenv("BROWSER_GATEWAY_API_KEY"))
	if key == "" {
		return Config{}, fmt.Errorf("BROWSER_GATEWAY_API_KEY is required")
	}

	driver, err := taskstore.ParseDriver(os.Getenv("BROWSER_GATEWAY_DRIVER"))
	if err != nil {
		return Config{}, err
	}

	return Config{
		ListenAddr:  listenAddr(),
		APIKey:      key,
		Concurrency: concurrency(),
		Driver:      driver,
	}, nil
}

func listenAddr() string {
	if addr := strings.TrimSpace(os.Getenv("BROWSER_GATEWAY_LISTEN")); addr != "" {
		return addr
	}
	return ":8080"
}

func concurrency() int {
	raw := strings.TrimSpace(os.Getenv("BROWSER_GATEWAY_CONCURRENCY"))
	if raw == "" {
		return 3
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return 3
	}
	return n
}
