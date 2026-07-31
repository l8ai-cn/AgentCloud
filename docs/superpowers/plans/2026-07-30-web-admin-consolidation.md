# Web Admin Consolidation

## Goal

Move meaningful system-administration workflows into `clients/web/app/admin`,
reuse the main session and design system, then remove `clients/web-admin` after
the last production workflow has passed browser verification.

## Capability Decision

| Capability | Decision | Reason |
|---|---|---|
| Dashboard statistics | Migrate | Real backend counters support daily operations. |
| User management | Migrate | Account access and admin grants are core operator workflows. |
| Organizations and subscriptions | Migrate | Required for tenant and billing operations. |
| SSO configuration | Migrate | Required for enterprise identity operations. |
| Runner management | Migrate | Required for execution-capacity operations. |
| Relay inventory and unregister | Migrate | Useful diagnostics; backend contract is real. |
| Relay session migration | Delete | UI calls explicit unimplemented adapters; no backend contract exists. |
| Ticket reply attachments | Delete | web-admin posted multipart to `/support-tickets/:id/reply`, which the backend removed; user uploads use the 3-step presign flow and no admin upload contract exists. Attachment download is migrated. |
| Organization member role edits | Not migrated | web-admin rendered members read-only and no admin member-mutation contract exists. |
| Organization profile updates | Not migrated | No `UpdateOrganization` admin contract exists; docs previously claimed otherwise. |
| Runner and user detail routes | Not migrated | web-admin had no such routes; list rows plus organization detail carry the operational fields. |
| Promo codes | Migrate | Required for commercial operations. |
| Support tickets | Migrate | Required for support operations. |
| Expert market review | Migrate | Required for publishing governance. |
| Audit logs | Migrated | Already available in `clients/web/app/admin/audit-logs`. |
| Notification bell | Delete | No backed notification workflow exists. |
| Hard-coded system health | Delete | It claims health without a health-check contract. |
| Standalone admin login/token | Delete at retirement | Main Web session is the authentication SSOT. |

## Delivery Phases

### Phase 1: Foundation and Accounts

- [x] Main Web admin guard and audit logs.
- [x] Shared admin navigation.
- [x] Dashboard statistics without fake health claims.
- [x] User search, pagination, access, verification, and admin actions.
- [x] Browser verification for desktop and mobile.

### Phase 2: Tenancy and Capacity

- [x] Organizations and organization detail.
- [x] Subscription and quota operations.
- [x] Runner management.
- [x] SSO configuration.

### Phase 3: Operations and Governance

- [x] Promo codes.
- [x] Support tickets.
- [x] Expert market review.
- [x] Relay inventory and force unregister.

### Phase 4: Source Retirement

- [x] Verify main Web build, local browser workflows, and marketing no-Wasm gate.
- [x] Remove web-admin build, routing, CI, image, and documentation references.
- [x] Delete `clients/web-admin`.

Source deletion landed before target-environment verification, which inverts the
original gate order. The consequence is tracked in Phase 5: the cluster still
runs the `web-admin` workload while the repository can no longer build it, so the
only safe path forward is to finish the release cutover rather than to restore
the deleted route.

### Phase 4.5: Console Hardening

- [x] Operator copy moved into the `admin` message namespace across all eight
      locales, at key and ICU-placeholder parity.
- [x] Mobile entry point to `/admin`, gated on `is_system_admin`.
- [x] Search debounce and pagination reset unified in `useSearchPagination`.
- [x] Component tests for every admin route plus `AdminGuard`, `AdminNavigation`,
      and the audit-log and dashboard API clients.
- [x] End-to-end coverage for user, subscription, SSO, promo code, runner, and
      support-ticket destructive actions.

`FormField` marks the required asterisk `aria-hidden` so the accessible name of a
required control is the label alone; assistive technology takes requiredness from
the control's own `required` attribute.

### Phase 5: Release Cutover

- [ ] Publish a `web` image built from a commit that contains the consolidated
      `/admin` routes.
- [ ] Point `deploy/kubernetes/cluster-oilan/release/` at that image digest.
- [ ] Run the deploy so `retire_web_admin` removes `deployment/web-admin`,
      `service/web-admin`, and `ingress/agentcloud-admin`.
- [ ] Verify every migrated workflow in the target environment.

`retire_web_admin` runs unconditionally after the `web` rollout. Deploying while
`release/` still pins a pre-consolidation `web` image deletes the old console
before the new routes exist, which leaves no administration surface at all. The
image digest must be updated in the same change that runs the retirement step.

## Completion Gates

Each migrated capability must satisfy all gates before its old route is disabled:

1. Backend authorization remains enforced by the system-admin interceptor.
2. Success, loading, empty, error, disabled, and permission states are visible.
3. Destructive actions require confirmation and produce audit logs.
4. Desktop and mobile browser workflows pass with no console or network errors.
5. Operator-facing copy resolves through the `admin` message namespace, with all
   eight locales at key parity.
6. Every route has a component test, and each destructive action has an
   end-to-end test.
7. The deployed route is removed only after the replacement is verified in the
   target environment.
