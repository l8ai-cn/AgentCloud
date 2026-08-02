# Grok Build (`grok-build`)

| Field | Value |
| --- | --- |
| Executable | `grok` |
| Adapter | `grok-build-acp` |
| Modes | `pty`, `acp` |
| Model | required=false; adapters=— |
| Definition | `config/worker-types/grok-build/definition.json` |
| AgentFile | `config/worker-types/grok-build/AgentFile` |

## Runtime image

not present in runtime catalog lock

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `model` | string | — | `""` |
| `effort` | select | `(empty)`, `low`, `medium`, `high` | `""` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `xai` | credential_bundle | `grok-build` | `XAI_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `XAI_API_KEY` | SECRET | `` |
| `GROK_HOME` | — | `sandbox.root + "/grok-home"` |

## Config documents

- none

## Tool model requirements

- none
