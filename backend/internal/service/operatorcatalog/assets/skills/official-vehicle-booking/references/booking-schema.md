# Booking Schema

Identity fields are prefilled from the authenticated user. Do not ask for
them unless they are missing.

## Prefill

- `applicant_name`
- `employee_id`
- `contact`
- `applicant_dept`
- `application_date` (system date, `YYYY-MM-DD`)

## Required to collect

- `passenger_count`: integer 1–50
- `student_count`: integer >= 0, default 0 if the user does not mention
  students; must be <= `passenger_count`
- `vehicle_type`: one or more of `小车`, `商务车`, `中巴车`, `大巴车`, `货车`
- `purpose`: non-empty free text
- `itineraries`: at least one leg, each with
  - `origin`
  - `destination`
  - `start_time` (`YYYY-MM-DD HH:MM`)
  - `end_time` (`YYYY-MM-DD HH:MM`, after `start_time`)
  - optional `origin_city` / `destination_city` for city-rule classification

## Optional

- `funding_source`: default `内支划转`; otherwise `单独开票`
- `waypoints`
- `deputy_driver`

## Normalization

- Resolve relative dates ("明天三点") against local civil time.
- On "改成…", replace the whole `itineraries` list. Do not keep stale legs.
- Keep enums in Chinese as listed above. Do not invent extra vehicle types.
