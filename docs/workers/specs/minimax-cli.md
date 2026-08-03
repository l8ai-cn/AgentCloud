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

`minimax-cli-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentsmesh/runner-minimax-cli@sha256:2dc2c7cfa8be8eb0d095a4af9a1a1eda9ce4f1a190dd11493ae26cb1d04fbf6f`

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
