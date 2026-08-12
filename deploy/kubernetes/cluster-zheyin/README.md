# Agent Cloud on doops-zheyin

Campus cluster via DoOps target `gw-zy` (`doops-zheyin/node-239`).

| Item | Value |
|------|-------|
| Public site | https://agents.zjcm.edu.cn |
| Legacy alias | https://doworker.zjcm.edu.cn (kept) |
| Namespace | `doworker` |
| Harbor | `repo.zjcm.edu.cn/doworker/*` |
| TLS | `zjcm-edu-cn-tls` (`*.zjcm.edu.cn`) |
| Ingress class | annotation `nginx-ingress-controller` |

This environment **adopts** the existing Agent Cloud stack in `doworker`
(Postgres/Redis/MinIO/Gitea already provisioned). It does not create a second
data plane. Git owns the canonical domain cutover + Helm overlay under
`deploy/environments/zheyin/values.yaml`.

## Identity model

```
校园 CAS  ──登录──▶  AMP
子系统 / AgentCloud  ──OIDC / AMP bearer──▶  AMP
```

CAS is **not** wired into AgentCloud. Campus unified login lands on AMP
(`docs/integrations/cas.md` in the AMP repo). AgentCloud federates AMP as OIDC
IdP and accepts AMP business access tokens (`amp_tenant_id` +
`amp_bearer_app_codes`).

## Deploy

```bash
doops login   # against doops.l8ai.cn / zheyin gateway as needed
cd deploy/kubernetes/cluster-zheyin
DOOPS_SESSION=$(doops session) ./deploy.sh
```

Also Helm-adopt backend/web/relay (optional; may thin ingress paths):

```bash
RUN_HELM=1 DOOPS_SESSION=$(doops session) ./deploy.sh
```

Helm-only app roll (after images exist in Harbor):

```bash
SKIP_IMAGE_SYNC=1 DOOPS_TARGET=gw-zy \
  bash scripts/release/doops_helm_deploy.sh zheyin
```

## DNS / WAF

Campus wildcard `*.zjcm.edu.cn` points at WAF VIP `172.16.99.247`. Unregistered
hosts get HTTP 488 (`wengine-auth-failed`). Until WAF adds
`agents.zjcm.edu.cn`, keep an explicit BIND override to the nginx-ingress
masters:

```bash
DOOPS_SESSION=$(doops session) bash patch-agents-dns.sh
# agents IN A 172.16.99.80 / 172.16.99.81
```

Prefer registering the hostname on the WAF long-term, then remove the override.

## Image sync

Push release tags into `repo.zjcm.edu.cn/doworker/<service>` before bumping
`imageTag` in `deploy/environments/zheyin/values.yaml`. Use
`release-YYYYMMDD` only — no feature suffixes on version tags.
