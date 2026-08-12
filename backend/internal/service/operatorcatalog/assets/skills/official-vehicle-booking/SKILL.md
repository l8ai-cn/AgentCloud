---
name: official-vehicle-booking
description: Guide a campus user through official vehicle booking with rules consent, field collection, confirmation, pledge, and optional portal submit. Use for durable booking workspaces, not generic chat or news briefs.
---

# Official Vehicle Booking

Run each request as a durable booking. Collect structured fields, enforce
rules, and stop at an explicit gate rather than improvising a portal submit.

## Required Workflow

1. Create `output/bookings/<booking-id>/brief.json` from the user's request
   and any prefilled identity.
2. Read `references/workspace-contract.md`, `references/booking-schema.md`,
   `references/rules.md`, and `references/hitl-gates.md` before collecting.
3. Walk the gates in order:
   `rules_consent` -> `collect` -> `confirm` -> `validate` -> `pledge` ->
   `submit` -> `poll`.
4. Use ACP permission questions or an explicit user confirmation for every
   HITL gate. Do not invent a form-collection graph.
5. Write `booking.json`, `rules-check.json`, `gates.json`, and `quality.md`.
6. Read every required output back before reporting completion.

## Gate Rules

- Decline at `rules_consent` or `pledge` ends the booking. Record the
  decision and stop.
- `validate` failures return to `collect` with `in_modification=true`.
  Do not re-ask `rules_consent` or `confirm` unless the user asks to start over.
- Never claim the booking was submitted to a campus portal unless
  `submit.json` contains a task id and a successful poll readback.

## Submit Boundary

Read `references/submit-adapter.md` before any submit call.

Submit is allowed only when a submit base URL and API key are present in
the launch environment. Without that path, finish the signed booking
snapshot and set submission to `pending_credentials`. This is an explicit
blocked platform step, not a successful booking and not a fallback.

Never log portal passwords, API keys, cookies, or CAS tickets.

## Completion

A booking is complete only when:

- `brief.json`, `booking.json`, `rules-check.json`, `gates.json`, and
  `quality.md` exist and were read back.
- Required fields in `booking.json` are present and internally consistent.
- `rules-check.json` records pass or a user-visible failure that returned
  to collect.
- If submit was requested, poll readback contains a terminal task status.
  If credentials were missing, `quality.md` result is `blocked` with
  `pending_credentials`.
