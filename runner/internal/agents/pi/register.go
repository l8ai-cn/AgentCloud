package pi

import (
	"log/slog"

	"github.com/l8ai-cn/agentcloud/runner/internal/acp"
	"github.com/l8ai-cn/agentcloud/runner/internal/agentkit"
	"github.com/l8ai-cn/agentcloud/runner/internal/tokenusage"
)

func init() {
	acp.RegisterTransport("pi-acp", func(cb acp.EventCallbacks, logger *slog.Logger) acp.Transport {
		return acp.NewACPTransport(cb, logger)
	})
	tokenusage.RegisterParserOptOut([]string{"pi", "pi-agent"})
	agentkit.RegisterProcessNames("pi", "pi-agent", "pi-acp")
	agentkit.RegisterAgentHome(agentkit.AgentHomeSpec{
		EnvVar:      "PI_CODING_AGENT_DIR",
		UserDirName: ".pi/agent",
	})
}
