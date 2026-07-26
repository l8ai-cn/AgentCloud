# AMP Authz Phases (AgentCloud)

## Goal

AgentCloud **Organization = AMP Tenant**. Identity and authorization both federate from AMP; AgentCloud remains the execution plane.

| Phase | Status | Deliverable |
|---|---|---|
| 0 | Done | `organizations.amp_tenant_id`, SSO tenant validation |
| 1 | Done | Login sync: AMP `roles` → `organization_members.role` |
| 2 | Done | Embedded `/authz/*.yaml` SSOT + `pkg/ampauthz` + `RequirePermission` |
| 3 | Done | Resolve org by `amp_tenant_id` (fail closed if unbound) |
| 4 | Done | Softlinks, catalog tests, runner/session permission gates, ops checklist |

## Authz SSOT

- Canonical files: `backend/pkg/ampauthz/authz/{permissions,roles,features,menus,workspace}.yaml`
- Repo-root `authz` is a **committed symlink** to that directory (AMP import path).
- Go loads the same files via `//go:embed` (`CatalogError` / `PermissionsForRole`).
- Local companion softlinks (not committed): run `bash scripts/setup-amp-softlinks.sh`
  - `AgentsMesh/amp` → sibling `../amp`
  - `code/ecp` → `amp` (legacy path used by zhiyong)
  - `zhiyong/amp` → `../amp`

Import the YAML bundle into AMP app `AGENTCLOUD` for each customer tenant.

## Mapping

| AMP | AgentCloud |
|---|---|
| `iam_tenant.code` | `organizations.amp_tenant_id` |
| Business JWT `roles` | `owner` / `admin` / `member` via `ampauthz.MapIdPRoles` |
| Permission codes in `/authz` | Enforced by `middleware.RequirePermission` from synced org role |

## Role map

| AMP role codes | AgentCloud |
|---|---|
| `ORG_OWNER`, `APP_ADMIN`, `OWNER`, `TENANT_OWNER` | `owner` |
| `ORG_ADMIN`, `OPERATOR`, `ADMIN`, `TENANT_ADMIN` | `admin` |
| `ORG_MEMBER`, `VIEWER`, `MEMBER`, … / empty | `member` |

## Execution-plane gates (P2/P4)

| Surface | Permission |
|---|---|
| Session policies write | `agentscloud:org:settings:write` |
| Runner gRPC tokens / reactivate | `agentscloud:runner:manage` |
| Cancel another user's queued pod | `agentscloud:runner:manage` |

## Guards

| Guard | Behavior |
|---|---|
| Empty IdP `roles` | Ensure membership only — **never demote** existing org role |
| `enforce_sso` OIDC | Requires `oidc_authorize_extra_params.tenantId` |
| Startup | `ampauthz.MustCatalogReady()` fails fast if `/authz` bundle missing |
| Connect runner tokens | `agentscloud:runner:manage` via `ampauthz.RoleHasPermission` |

## Ops checklist (per customer tenant)

1. Create AgentCloud org (slug).
2. `UPDATE organizations SET amp_tenant_id = '<AMP code>' WHERE slug = '...'`.
3. Set `sso_configs.default_organization_id` to that org; `oidc_authorize_extra_params = {"tenantId":"<AMP code>"}`.
4. Import `authz/*.yaml` into AMP app `AGENTCLOUD` for that tenant; assign roles.
5. Login must assert `tenant_id` matching `amp_tenant_id` or fail with `tenant_unbound`.
6. Local: `bash scripts/setup-amp-softlinks.sh` when working across AMP + AgentsMesh.
7. Prefer web `AmpPreferredLogin` (`?local=1` escape hatch) over ingress `/login` rewrite snippets — keep ingress transparent (`/api`→backend, `/`→web, `/auth/*` on web).
8. Oilan alias host `agents.l8ai.cn` is in `deploy/kubernetes/cluster-oilan/41-agents-ingress.yaml`.
