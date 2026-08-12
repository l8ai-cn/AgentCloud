# Campus Daily Brief Workspace Contract

Use paths relative to the current worker workspace:

```text
output/episodes/<listening-date>/
  window.json
  articles.md
  script.json
  audio.mp3
  quality.md
  events.jsonl
```

`<listening-date>` is `YYYY-MM-DD`.

`window.json` records listening date, weekday, lunar text, news start/end
dates, and whether the day is a rest day.

`articles.md` is the packaged LLM input: `【开场白】`, `【新闻部分】`,
`【通知部分】`. Write it before the script.

`script.json` matches the `Script` schema in `script-rules.md`. Do not
wrap it in a markdown fence.

`audio.mp3` exists only after a successful TTS adapter call. Omit it when
audio is `pending_credentials`.

`quality.md` records evidence paths, dropped-article checks, adapter
status, and an explicit result: `complete`, `partial`, or `blocked`.

`events.jsonl` is append-only. Each line contains `at`, `type`, `status`,
and non-secret evidence paths. Never store API keys, passwords, or cookies.

Do not report an artifact by intended path. Read the file, validate its
content, and then cite the path.
