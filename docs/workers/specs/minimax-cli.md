# MiniMax CLI (`minimax-cli`)

| Field | Value |
| --- | --- |
| Executable | `mmx` |
| Adapter | `minimax-pty` |
| Modes | `pty` |
| Model | required=true; adapters=minimax |
| Definition | `config/worker-types/minimax-cli/definition.json` |
| AgentFile | `config/worker-types/minimax-cli/AgentFile` |

## Runtime image

not present in runtime catalog lock

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `model` | string | — | `""` |
| `base_url` | string | — | `""` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `minimax-api-key` | model_resource | `minimax` | `MINIMAX_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `MINIMAX_API_KEY` | SECRET OPTIONAL | `` |

## Config documents

- none

## Tool model requirements

- none
