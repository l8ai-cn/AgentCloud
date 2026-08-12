# Vehicle Booking Rules

Load campus overrides from `brief.json.rules` when present. Defaults below
are Hangzhou-centric and must be parameterized per campus (`home_city`,
`local_advance_workdays`, `remote_advance_workdays`, `accept_window`).

Advance days exclude the application calendar day. Count workdays only.

## 1. Accept window — error

Default: accept applications all day (`00:00–24:00`). A campus may narrow
this (for example `07:00–18:00`). Outside the window is a hard fail.

## 2. Local trip advance — error

If every origin and destination is inside `home_city` (default 杭州市,
including 萧山 / 余杭 / 临安 and other districts), require at least
`local_advance_workdays` (default 1) before the earliest `start_time`.

## 3. Remote trip advance — error

If any origin or destination is outside `home_city`, require at least
`remote_advance_workdays` (default 3) before the earliest `start_time`.

## 4. Passenger caps — error

`passenger_count` <= 50. `student_count` <= `passenger_count`.

## 5. Itinerary sanity — warning

Origins and destinations must be meaningful places. Each `end_time` must
be after that leg's `start_time`.

## Evaluation

Write every rule into `rules-check.json` with severity, pass/fail, and
the values used. Any error fail returns to collect. Warnings are shown
to the user but do not block pledge unless the campus override says so.
