# Loopal (`loopal`)

| Field | Value |
| --- | --- |
| Executable | `loopal` |
| Adapter | `loopal-acp` |
| Modes | `pty`, `acp` |
| Model | required=false; adapters=— |
| Definition | `config/worker-types/loopal/definition.json` |
| AgentFile | `config/worker-types/loopal/AgentFile` |

## Runtime image

not present in runtime catalog lock

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `permission_mode` | select | `supervised`, `auto`, `bypass` | `"supervised"` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `anthropic` | credential_bundle | `loopal` | `ANTHROPIC_API_KEY` |
| `openai` | credential_bundle | `loopal` | `OPENAI_API_KEY` |
| `google` | credential_bundle | `loopal` | `GOOGLE_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | SECRET OPTIONAL | `` |
| `OPENAI_API_KEY` | SECRET OPTIONAL | `` |
| `GOOGLE_API_KEY` | SECRET OPTIONAL | `` |

## Config documents

- none

## Tool model requirements

- none
