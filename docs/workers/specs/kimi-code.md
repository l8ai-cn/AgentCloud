# Kimi Code (`kimi-code`)

| Field | Value |
| --- | --- |
| Executable | `kimi` |
| Adapter | `kimi-acp` |
| Modes | `pty`, `acp` |
| Model | required=true; adapters=openai-compatible |
| Definition | `config/worker-types/kimi-code/definition.json` |
| AgentFile | `config/worker-types/kimi-code/AgentFile` |

## Runtime image

not present in runtime catalog lock

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| — | — | — | — |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `kimi-api-key` | model_resource | `openai-compatible` | `KIMI_API_KEY` |
| `kimi-base-url` | model_resource | `openai-compatible` | `KIMI_BASE_URL` |
| `kimi-model-name` | model_resource | `openai-compatible` | `KIMI_MODEL_NAME` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `KIMI_API_KEY` | SECRET OPTIONAL | `` |
| `KIMI_BASE_URL` | TEXT OPTIONAL | `` |
| `KIMI_MODEL_NAME` | TEXT OPTIONAL | `` |
| `KIMI_CODE_HOME` | — | `sandbox.root + "/kimi-code-home"` |

## Config documents

- none

## Tool model requirements

- none
