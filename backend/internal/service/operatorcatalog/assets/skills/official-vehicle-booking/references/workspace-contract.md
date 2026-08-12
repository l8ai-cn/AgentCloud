# Vehicle Booking Workspace Contract

Use paths relative to the current worker workspace:

```text
output/bookings/<booking-id>/
  brief.json
  booking.json
  rules-check.json
  gates.json
  submit.json
  quality.md
  events.jsonl
```

`brief.json` records the normalized request, prefilled identity, locale,
requested submit state, and unresolved inputs.

`booking.json` is the structured payload from `booking-schema.md`. Update it
when the user modifies itineraries; replace the itinerary list instead of
merging stale legs.

`rules-check.json` records each rule name, severity, pass/fail, and the
evidence used (city classification, workday count, passenger caps).

`gates.json` records HITL outcomes: `rules_consent`, `confirm`, `pledge`.
Each entry has `status` (`accepted`, `declined`, `modify`, `pending`) and
a timestamp. Do not invent a signed pledge.

`submit.json` exists only after a submit attempt. It records adapter URL
host (never the key), `task_id`, poll snapshots, and terminal status.
Omit it when submission is `pending_credentials`.

`quality.md` records evidence paths, missing items, and an explicit result:
`complete`, `partial`, or `blocked`.

`events.jsonl` is append-only. Each line contains `at`, `type`, `status`,
and non-secret evidence paths. Never store passwords, API keys, cookies,
or CAS tickets.

Do not report an artifact by intended path. Read the file, validate its
content, and then cite the path.
