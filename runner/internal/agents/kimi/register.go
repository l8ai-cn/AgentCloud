package kimi

import (
	"log/slog"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
	"github.com/l8ai-cn/agentcloud/runner/internal/agentkit"
	"github.com/l8ai-cn/agentcloud/runner/internal/tokenusage"
)

func init() {
	acp.RegisterTransport("kimi-acp", func(cb acp.EventCallbacks, logger *slog.Logger) acp.Transport {
		return acp.NewACPTransport(cb, logger)
	})
	tokenusage.RegisterParserOptOut([]string{"kimi", "kimi-code"})
	agentkit.RegisterProcessNames("kimi")
	agentkit.RegisterAgentHome(agentkit.AgentHomeSpec{
		EnvVar:      "KIMI_CODE_HOME",
		UserDirName: ".kimi-code",
	})
}
