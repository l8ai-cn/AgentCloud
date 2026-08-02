# Do Agent Worker Status

Do Agent is a formal Worker type with an explicit ACP adapter. A runtime image
digest is published in the immutable catalog lock, but formal product-path
evidence is incomplete, so the type stays `runtime_ready_unverified` until the
browser/product gates below are accepted.

| Area | Contract |
| --- | --- |
| Worker slug | `do-agent` |
| Executable | `do-agent` |
| Adapter | `do-agent-acp` |
| Interaction modes | PTY and ACP |
| Model resources | OpenAI-compatible or Anthropic |
| Credential injection | `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` |
| Configuration document | JSON `settings` written through `DO_AGENT_SETTINGS` |
| Runtime lock | Published (`do-agent-stable`) |
| Browser and product-path evidence | Incomplete |

Authoritative Definition / AgentFile / generated spec:

```text
config/worker-types/do-agent/definition.json
config/worker-types/do-agent/AgentFile
docs/workers/specs/do-agent.md
```

Model credentials are selected through `model_resource_id`; they are not accepted
as plaintext form fields or arbitrary environment bundles.

## Completion Gates

Promote Do Agent only after all of the following are recorded:

1. Runner starts the exact `do-agent-acp` transport for ACP mode without
   executable-name inference.
2. The product path preflights a compatible model resource, creates a Worker,
   exchanges a real ACP prompt and response, and terminates cleanly.
3. Catalog-loop evidence flips `support_status` off `not_supported`.
