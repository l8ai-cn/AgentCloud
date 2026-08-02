# Gemini CLI (`gemini-cli`)

| Field | Value |
| --- | --- |
| Executable | `gemini` |
| Adapter | `gemini-acp` |
| Modes | `pty`, `acp` |
| Model | required=true; adapters=gemini |
| Definition | `config/worker-types/gemini-cli/definition.json` |
| AgentFile | `config/worker-types/gemini-cli/AgentFile` |

## Runtime image

`gemini-cli-stable` enabled=false availability=invalid_published_digest

`repo.aiedulab.cn:8443/agentcloud/runner-gemini-cli@sha256:852dba55bcc3213c72a7ee94e9c2da29a44e2ba0d5a9c0a8c15fea5adb8c6cd4`

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
| `sandbox_mode` | boolean | — | `false` |

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
| `gemini-api-key` | model_resource | `gemini` | `GEMINI_API_KEY` |

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
| `GEMINI_API_KEY` | SECRET OPTIONAL | `` |

## Config documents

- none

## Tool model requirements

- none
