# Pi Agent (`pi-agent`)

| Field | Value |
| --- | --- |
| Executable | `pi-agent` |
| Adapter | `pi-acp` |
| Modes | `pty`, `acp` |
| Model | required=true; adapters=openai-compatible |
| Definition | `config/worker-types/pi-agent/definition.json` |
| AgentFile | `config/worker-types/pi-agent/AgentFile` |

## Runtime image

not present in runtime catalog lock

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| — | — | — | — |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `openai-api-key` | model_resource | `openai-compatible` | `OPENAI_API_KEY` |
| `openai-base-url` | model_resource | `openai-compatible` | `OPENAI_BASE_URL` |
| `openai-model` | model_resource | `openai-compatible` | `OPENAI_MODEL` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `PI_CODING_AGENT_DIR` | — | `sandbox.root + "/pi-home/agent"` |
| `OPENAI_API_KEY` | SECRET | `` |
| `OPENAI_BASE_URL` | TEXT OPTIONAL | `` |
| `OPENAI_MODEL` | TEXT OPTIONAL | `` |
| `PI_OFFLINE` | — | `"1"` |
| `PI_SKIP_VERSION_CHECK` | — | `"1"` |

## Config documents

- none

## Tool model requirements

- none
