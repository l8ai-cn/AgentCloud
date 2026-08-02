# Video Studio (`video-studio`)

| Field | Value |
| --- | --- |
| Executable | `video-studio-codex` |
| Adapter | `codex-app-server` |
| Modes | `pty`, `acp` |
| Model | required=true; adapters=openai-compatible |
| Definition | `config/worker-types/video-studio/definition.json` |
| AgentFile | `config/worker-types/video-studio/AgentFile` |

## Runtime image

`video-studio-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentcloud/runner-video-studio@sha256:4f243b28b02b105659cf31af0f53aa49c01effc20df60080e5334cebafce8b5d`

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
| `CODEX_HOME` | — | `sandbox.root + "/video-studio-home"` |

## Config documents

- none

## Tool model requirements

- none
