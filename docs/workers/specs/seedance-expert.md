# Seedance Expert (`seedance-expert`)

| Field | Value |
| --- | --- |
| Executable | `do-agent` |
| Adapter | `do-agent-acp` |
| Modes | `pty`, `acp` |
| Model | required=true; adapters=openai-compatible, anthropic |
| Definition | `config/worker-types/seedance-expert/definition.json` |
| AgentFile | `config/worker-types/seedance-expert/AgentFile` |

## Runtime image

`seedance-expert-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentcloud/runner-do-agent@sha256:66338b96672152530f9a9c4611af9958d63f22b888598d857614f8974cb26ccd`

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `model` | string | — | `""` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `openai` | model_resource | `openai-compatible` | `OPENAI_API_KEY` |
| `anthropic` | model_resource | `anthropic` | `ANTHROPIC_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `DO_AGENT_HOME` | — | `sandbox.root + "/seedance-expert-home"` |
| `DO_AGENT_SETTINGS` | — | `sandbox.root + "/seedance-expert-home/settings.json"` |
| `DO_AGENT_LOG_DIR` | — | `sandbox.root + "/seedance-expert-home/logs"` |
| `OPENAI_API_KEY` | SECRET OPTIONAL | `` |
| `ANTHROPIC_API_KEY` | SECRET OPTIONAL | `` |
| `SEEDANCE_API_KEY` | SECRET OPTIONAL | `` |
| `SEEDANCE_BASE_URL` | TEXT OPTIONAL | `` |
| `SEEDANCE_MODEL` | TEXT OPTIONAL | `` |

## Config documents

- `settings` (json) → `DO_AGENT_SETTINGS` **required**

## Tool model requirements

- `seedance-video` modality=video capability=video-generation required=false
