# Aider (`aider`)

| Field | Value |
| --- | --- |
| Executable | `aider` |
| Adapter | `aider-pty` |
| Modes | `pty` |
| Model | required=false; adapters=— |
| Definition | `config/worker-types/aider/definition.json` |
| AgentFile | `config/worker-types/aider/AgentFile` |

## Runtime image

not present in runtime catalog lock

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `model` | string | — | `""` |
| `edit_format` | select | `(empty)`, `whole`, `diff`, `udiff` | `""` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `openai` | credential_bundle | `aider` | `OPENAI_API_KEY` |
| `anthropic` | credential_bundle | `aider` | `ANTHROPIC_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `OPENAI_API_KEY` | SECRET OPTIONAL | `` |
| `ANTHROPIC_API_KEY` | SECRET OPTIONAL | `` |

## Config documents

- none

## Tool model requirements

- none
