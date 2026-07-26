# Oilan Endpoints

- **Canonical app entry:** https://agents.l8ai.cn
  (`/api`, `/proto.`, `/relay`, `/runner/tunnel`, `/health`, `/login`)
- Alias (kept for existing bookmarks / IdP registrations): https://dowork.l8ai.cn
- IM pairing (logged-in): `/settings/im-pair` — see
  [`docs/integrations/im-worker-connect.md`](../../../docs/integrations/im-worker-connect.md)
- Isolated Pod preview: `https://<pod-key>.l8ai.cn` (`/preview` only)
- Mobile Worker entry: https://mobile.l8ai.cn
- Marketplace Storefront: https://market.l8ai.cn
- Marketplace API: https://market.l8ai.cn/api/marketplace/v1
- Organization marketplace: https://agents.l8ai.cn/dev-org/marketplace
- Admin console: https://admin.l8ai.cn (separate host, no `/admin` basePath)
- Object storage (presigned URLs): https://minio.dowork.l8ai.cn
- Test account: `admin@agentcloud.local / Ab123456`

Live namespace is **`agentsmesh`** (Harbor `…/agentsmesh/*`).
`agents.l8ai.cn` ingress (+ relay + tunnel + AMP `/login`) is owned by
`deploy/helm/agentsmesh` — do not revive `41-agents-ingress.yaml` under the
kustomize tree (`namespace: agentcloud` would rewrite it into a dead ns).

Repo `deploy.sh` still targets `agentcloud` for the rest of the stack; do not
mix that path with live `agentsmesh` until the namespace migration lands.

DNS for `agents.l8ai.cn`, `dowork.l8ai.cn`, `market.l8ai.cn`, `mobile.l8ai.cn`,
`admin.l8ai.cn`, `*.l8ai.cn`, and `minio.dowork.l8ai.cn` must point at the
Oilan node.

Each Pod preview uses `<pod-key>.l8ai.cn`, covered by the existing
`l8ai-wildcard-tls` Secret. Relay accepts `/preview` only when the request Host
matches the Pod key in the path, so the wildcard Ingress does not create a
shared preview origin.

`PRIMARY_DOMAIN` / token issuer / JWKS URL are `agents.l8ai.cn`.
`RELAY_ALLOWED_ORIGINS` includes agents + dowork + mobile so either browser
origin can attach terminals.
