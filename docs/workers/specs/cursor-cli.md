# Cursor CLI (`cursor-cli`)

| Field | Value |
| --- | --- |
| Executable | `agent` |
| Adapter | `cursor-acp` |
| Modes | `pty`, `acp` |
| Model | required=false; adapters=— |
| Definition | `config/worker-types/cursor-cli/definition.json` |
| AgentFile | `config/worker-types/cursor-cli/AgentFile` |

## Runtime image

not present in runtime catalog lock

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| — | — | — | — |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `cursor` | credential_bundle | `cursor` | `CURSOR_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `CURSOR_API_KEY` | SECRET | `` |

## Config documents

- none

## Tool model requirements

- none
