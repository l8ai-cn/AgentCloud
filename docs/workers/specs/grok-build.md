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

`grok-build-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentsmesh/runner-grok-build@sha256:b9dd3a16b508e07641ec5ae50ceb191e61196234d9ce9d99c4aec374a038d103`

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
