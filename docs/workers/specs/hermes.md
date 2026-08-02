# Hermes (`hermes`)

| Field | Value |
| --- | --- |
| Executable | `hermes` |
| Adapter | `hermes-pty` |
| Modes | `pty` |
| Model | required=true; adapters=openai-compatible |
| Definition | `config/worker-types/hermes/definition.json` |
| AgentFile | `config/worker-types/hermes/AgentFile` |

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
| `OPENAI_API_KEY` | SECRET OPTIONAL | `` |

## Config documents

- none

## Tool model requirements

- none
