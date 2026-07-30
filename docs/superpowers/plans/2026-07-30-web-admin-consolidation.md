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
| Relay inventory and unregister | Migrate later | Useful diagnostics; backend contract is real. |
| Relay session migration | Delete | UI calls explicit unimplemented adapters; no backend contract exists. |
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

### Phase 4: Retirement

- [x] Verify main Web build, local browser workflows, and marketing no-Wasm gate.
- [ ] Production routes in `clients/web-admin` have no remaining users.
- [ ] Remove web-admin deployment, routing, CI scripts, and documentation.
- [ ] Delete `clients/web-admin`.
- [ ] Verify migrated workflows in the target environment.

Phase 4 starts only after the migrated `/admin` routes pass the same browser
workflows in the target environment. Local verification is not sufficient to
remove the existing production route.

## Completion Gates

Each migrated capability must satisfy all gates before its old route is disabled:

1. Backend authorization remains enforced by the system-admin interceptor.
2. Success, loading, empty, error, disabled, and permission states are visible.
3. Destructive actions require confirmation and produce audit logs.
4. Desktop and mobile browser workflows pass with no console or network errors.
5. The old route is removed only after the new route is verified in the target environment.
