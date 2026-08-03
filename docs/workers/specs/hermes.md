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

`hermes-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentsmesh/runner-hermes@sha256:07dad6492237ce7977aea985a6677b852b3b316b5d50adec2320c543a8e0c196`

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
