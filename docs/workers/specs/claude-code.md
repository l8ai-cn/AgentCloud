# Claude Code (`claude-code`)

| Field | Value |
| --- | --- |
| Executable | `claude` |
| Adapter | `claude-stream-json` |
| Modes | `pty`, `acp` |
| Model | required=true; adapters=anthropic |
| Definition | `config/worker-types/claude-code/definition.json` |
| AgentFile | `config/worker-types/claude-code/AgentFile` |

## Runtime image

`claude-code-stable` enabled=false availability=invalid_published_digest

`repo.aiedulab.cn:8443/agentcloud/runner-claude-code@sha256:a9a02976dec14907be8eb6a7f68cd1adc5158099645244be733546b0f3e7041f`

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `model` | select | `(empty)`, `sonnet`, `opus` | `""` |
| `permission_mode` | select | `default`, `plan`, `acceptEdits`, `dontAsk`, `bypassPermissions` | `"bypassPermissions"` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `anthropic-api-key` | model_resource | `anthropic` | `ANTHROPIC_API_KEY` |
| `anthropic-base-url` | model_resource | `anthropic` | `ANTHROPIC_BASE_URL` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | SECRET OPTIONAL | `` |
| `ANTHROPIC_BASE_URL` | TEXT OPTIONAL | `` |
| `CLAUDE_CONFIG_DIR` | — | `sandbox.root + "/claude-home"` |

## Config documents

- none

## Tool model requirements

- none
