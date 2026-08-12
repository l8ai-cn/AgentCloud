# Adapters

Campus crawl, TTS, and object storage are outside this skill. Call them
only through launch env. Missing env is `pending_credentials`, not a
reason to scrape or to fake audio.

## NewsSource.fetch(date) -> Article[]

- `CAMPUS_NEWS_SOURCE_URL` — base URL for `GET .../articles?date=YYYY-MM-DD`
- `CAMPUS_NEWS_API_KEY` — optional `X-API-Key`

Each article needs `title`, `body` or equivalent, `date`, and optional
`kind` (`news` | `notice`). If the URL is missing, accept user-supplied
markdown in the turn and skip the network fetch. Do not log in to a
campus portal or drive a browser from this skill.

## TTS.synthesize(script) -> audio bytes

Dual-speaker synthesis of `script.json` lines (`female` / `male`) to MP3.
If TTS credentials are missing, keep `script.json` and set audio to
`pending_credentials`.

## AudioStore.put(date, mp3, script)

Store audio plus a text dump of lines prefixed `[女]/` and `[男]:`.
If the store is missing, leave files in `output/episodes/<date>/` and set
store to `pending_credentials`.

Never write adapter secrets into `events.jsonl` or `quality.md`.
