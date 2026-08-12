# Submit Adapter

Campus portal automation is outside this skill. The worker only calls a
generic async task API when launch env is present.

## Environment

- `VEHICLE_BOOKING_SUBMIT_URL` — base URL, no trailing slash
- `VEHICLE_BOOKING_API_KEY` — sent as `X-API-Key`
- `CAMPUS_PORTAL_USERNAME` / `CAMPUS_PORTAL_PASSWORD` — optional, per-user
  portal binding supplied by the caller, never written to the workspace

If the base URL or API key is missing, do not guess a host. Stop with
`pending_credentials`.

## Create task

`POST {VEHICLE_BOOKING_SUBMIT_URL}/api/v1/vehicle-booking/tasks`

```json
{
  "thread_id": "<booking-id>",
  "user_id": "<employee_id>",
  "agent_type": "vehicle_booking",
  "booking_data": { },
  "username": "<optional>",
  "password": "<optional>"
}
```

`booking_data` is the `booking.json` object. Prefer this stateless body
over any server-side draft lookup.

Success: HTTP 202 with `data.task_id`. Write `submit.json` with `task_id`
and omit secrets.

## Poll

`GET {VEHICLE_BOOKING_SUBMIT_URL}/api/v1/vehicle-booking/tasks/{task_id}`

Poll until a terminal status (`completed`, `failed`, `cancelled`) or the
campus timeout. Append non-secret progress snapshots to `submit.json`.

A completed poll with a booking / ticket id is the only valid submit
success. Adapter errors, timeouts, and missing task ids are failures.
Do not claim the campus form was filled by this worker.
