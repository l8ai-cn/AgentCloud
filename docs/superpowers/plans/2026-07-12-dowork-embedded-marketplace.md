# AgentCloud Embedded Marketplace Implementation Plan

**Goal:** close Marketplace inside the AgentCloud organization workflow while
retaining independent Marketplace API data ownership.

**Status (2026-07-26):** done for deploy path. Standalone `clients/marketplace-web`
removed; `market.l8ai.cn` serves `web` with host/path redirects to
`agents.l8ai.cn/marketplace*`. Marketplace API remains a separate Go service.

## Acceptance Scenarios

1. Given an authenticated member opens `/{org}/marketplace`, when the catalog
   loads, then the activity bar highlights “市场” and content is Chinese.
2. Given a Listing is an application, when enablement is chosen, then the plan
   targets URL organization and confirmation exposes credits and permissions.
3. Given a Listing is not runtime-installable, when a member views it, then the
   UI states the missing integration and never presents a succeeding action.
4. Given a legacy market URL, when visited, then it redirects to canonical
   AgentCloud organization market.

## Steps And Checks

1. [x] Add market activity and nested routes.
2. [x] Build dashboard catalog and detail.
3. [x] Bind acquisition to organization route.
4. [x] Replace public traffic — delete standalone workload; `market.l8ai.cn` → web.
5. [x] Release/CD no longer builds or deploys `marketplace-web`.
