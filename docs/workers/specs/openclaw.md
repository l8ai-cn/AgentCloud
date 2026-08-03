# OpenClaw (`openclaw`)

| Field | Value |
| --- | --- |
| Executable | `openclaw` |
| Adapter | `openclaw-pty` |
| Modes | `pty` |
| Model | required=true; adapters=openai-compatible |
| Definition | `config/worker-types/openclaw/definition.json` |
| AgentFile | `config/worker-types/openclaw/AgentFile` |

## Runtime image

`openclaw-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentsmesh/runner-openclaw@sha256:d63c0ccfffc44bb57623e411f43318f19d9b31301e62e5532fe9ab72dfcef33c`

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
| `OPENCLAW_HOME` | — | `sandbox.root + "/openclaw-home"` |
| `OPENAI_API_KEY` | SECRET OPTIONAL | `` |

## Config documents

- `openclaw-json` (json) → `openclaw-home/.openclaw/openclaw.json`

## Tool model requirements

- none
