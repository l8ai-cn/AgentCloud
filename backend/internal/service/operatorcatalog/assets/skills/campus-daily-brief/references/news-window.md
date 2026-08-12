# News Window

The episode date is the listening day. News is the previous working day,
not "today's CMS scrape" unless the campus override says so.

## Weekday-only publish

Monday–Friday produce an episode. Saturday, Sunday, and campus rest days
do not. Record `rest: true` in `window.json` and stop.

A campus may also skip statutory holidays. If a holiday calendar is not
supplied, treat only weekends as rest days. The scriptwriter may still
greet a festival that falls on a weekday.

## Default window

1. Start from listening date minus one day.
2. Walk backward while that day is a rest day, up to 30 days.
3. `start` is the first working day found. `end` is listening date minus
   one day (so a Monday after a weekend covers Friday, and a long weekend
   may span multiple days).
4. Fetch every calendar day from `start` through `end` and merge.

## Examples

- Tuesday listen -> Monday news.
- Monday listen -> Friday news (Saturday–Sunday skipped).
- Wednesday after a Mon–Tue holiday -> previous working day through
  Tuesday, merged.

## Pre-generate

A scheduler may generate tomorrow's weekday episode in the evening. The
skill still keys artifacts by listening date, not by generation time.
