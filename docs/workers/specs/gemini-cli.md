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

`gemini-cli-stable` enabled=true availability=locked_available

`repo.aiedulab.cn:8443/agentsmesh/runner-gemini-cli@sha256:c75bc17c29e9c6b85a7e4ae89347e5fa93ff82fdff296a925de44513082b0e7d`

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
