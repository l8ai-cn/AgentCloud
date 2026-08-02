# Codex CLI (`codex-cli`)

| Field | Value |
| --- | --- |
| Executable | `codex` |
| Adapter | `codex-app-server` |
| Modes | `pty`, `acp` |
| Model | required=true; adapters=openai-compatible |
| Definition | `config/worker-types/codex-cli/definition.json` |
| AgentFile | `config/worker-types/codex-cli/AgentFile` |

## Runtime image

`codex-cli-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentcloud/runner-codex-cli@sha256:854952254d5f7ce25db3258034bc71a07169a5730dfe0670243fc10ea437bacd`

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `approval_mode` | select | `untrusted`, `on-request`, `never` | `"untrusted"` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `openai` | model_resource | `openai-compatible` | `OPENAI_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `OPENAI_API_KEY` | SECRET OPTIONAL | `` |
| `CODEX_HOME` | — | `sandbox.root + "/codex-home"` |

## Config documents

- none

## Tool model requirements

- none
