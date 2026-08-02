# Pattern Designer (`pattern-designer`)

| Field | Value |
| --- | --- |
| Executable | `codex` |
| Adapter | `codex-app-server` |
| Modes | `pty`, `acp` |
| Model | required=true; adapters=openai-compatible |
| Definition | `config/worker-types/pattern-designer/definition.json` |
| AgentFile | `config/worker-types/pattern-designer/AgentFile` |

## Runtime image

`pattern-designer-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentcloud/runner-codex-cli@sha256:854952254d5f7ce25db3258034bc71a07169a5730dfe0670243fc10ea437bacd`

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `approval_mode` | select | `untrusted`, `on-request`, `never` | `"never"` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `openai` | model_resource | `openai-compatible` | `OPENAI_API_KEY` |
| `lovart-access-key` | credential_bundle | `lovart` | `LOVART_ACCESS_KEY` |
| `lovart-secret-key` | credential_bundle | `lovart` | `LOVART_SECRET_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `OPENAI_API_KEY` | SECRET OPTIONAL | `` |
| `LOVART_ACCESS_KEY` | SECRET | `` |
| `LOVART_SECRET_KEY` | SECRET | `` |
| `CODEX_HOME` | — | `sandbox.root + "/codex-home"` |
| `LOVART_SKILL_PATH` | — | `sandbox.root + "/codex-home/skills/lovart-api/agent_skill.py"` |

## Config documents

- none

## Tool model requirements

- none
