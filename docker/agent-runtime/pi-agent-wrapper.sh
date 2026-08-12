#!/bin/sh
set -eu

agent_dir="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"
mkdir -p "${agent_dir}"

if [ -n "${OPENAI_BASE_URL:-}" ] && [ -n "${OPENAI_API_KEY:-}" ]; then
  AGENT_DIR="${agent_dir}" node <<'NODE'
const fs = require("fs");
const path = require("path");
const agentDir = process.env.AGENT_DIR;
const model = (process.env.OPENAI_MODEL || "default").trim() || "default";
const baseUrl = process.env.OPENAI_BASE_URL.replace(/\/+$/, "");
const models = {
  providers: {
    "openai-compatible": {
      baseUrl,
      api: "openai-completions",
      apiKey: "$OPENAI_API_KEY",
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
      },
      models: [
        {
          id: model,
          name: model,
          reasoning: false,
          input: ["text"],
          contextWindow: 128000,
          maxTokens: 16384,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      ],
    },
  },
};
fs.writeFileSync(path.join(agentDir, "models.json"), JSON.stringify(models, null, 2) + "\n");
fs.writeFileSync(
  path.join(agentDir, "settings.json"),
  JSON.stringify(
    {
      defaultProvider: "openai-compatible",
      defaultModel: model,
      quietStartup: true,
    },
    null,
    2,
  ) + "\n",
);
NODE
fi

if [ "${1:-}" = "acp" ]; then
  shift
  exec pi-acp "$@"
fi

exec pi "$@"
