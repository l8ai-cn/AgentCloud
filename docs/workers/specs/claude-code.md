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

`claude-code-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentsmesh/runner-claude-code@sha256:20c2ab259b813f3f5187ebe8afc382d19da2e7f68fe9916191f9626fe69fa119`

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
