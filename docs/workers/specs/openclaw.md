# OpenClaw (`openclaw`)

| Field | Value |
| --- | --- |
| Executable | `openclaw` |
| Adapter | `openclaw-pty` |
| Modes | `pty` |
| Model | required=true; adapters=openai-compatible |
| Definition | `config/worker-types/openclaw/definition.json` |
| AgentFile | `config/worker-types/openclaw/AgentFile` |

## Runtime image

not present in runtime catalog lock

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| — | — | — | — |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `openai` | model_resource | `openai-compatible` | `OPENAI_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `OPENCLAW_HOME` | — | `sandbox.root + "/openclaw-home"` |
| `OPENAI_API_KEY` | SECRET OPTIONAL | `` |

## Config documents

- `openclaw-json` (json) → `openclaw-home/.openclaw/openclaw.json`

## Tool model requirements

- none
