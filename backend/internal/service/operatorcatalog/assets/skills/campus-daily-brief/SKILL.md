---
name: campus-daily-brief
description: Produce a weekday dual-host campus daily news brief from school news and notices. Use for 甜甜60秒-style episodes, not interactive news RAG chat.
---

# Campus Daily Brief

Run each episode as a durable brief. Package the news window, write a
spoken dual-host script, and stop at an explicit adapter gate rather than
improvising crawl or TTS credentials.

## Required Workflow

1. Resolve the listening date and write
   `output/episodes/<listening-date>/window.json`.
2. Read `references/workspace-contract.md`, `references/episode-contract.md`,
   `references/news-window.md`, and `references/script-rules.md` before
   writing the script.
3. Walk the pipeline in order:
   `window` -> `fetch` -> `package` -> `script` -> `tts` -> `store` -> `qa`.
4. Write `articles.md`, `script.json`, and `quality.md`.
5. Read every required output back before reporting completion.

This skill is the daily brief product. Do not use it for the campus news
Q&A assistant.

## Publish Rules

- Weekday listening dates only. Weekend or rest-day requests get a rest
  note in `quality.md` and no script.
- Cover every fetched article. Empty news becomes `暂无新闻`, not invented
  campus events.
- Target spoken length is 60–90 seconds. Do not expand to a long magazine
  show.

## Adapter Boundary

Read `references/adapters.md` before fetch, TTS, or store calls.

- Missing news source: do not scrape a campus portal. Stop fetch with
  `pending_credentials` unless the user supplied article markdown.
- Missing TTS: deliver `script.json` and set audio to `pending_credentials`.
- Missing audio store: keep artifacts in the workspace and set store to
  `pending_credentials`.

Never log API keys, portal passwords, or cookies.

## Completion

An episode is complete only when:

- `window.json`, `articles.md`, `script.json`, and `quality.md` exist and
  were read back.
- The opening line preserves the packaged date, weekday, and lunar text.
- Every article in `articles.md` appears in `script.json`.
- If TTS was requested and credentials were present, audio exists and was
  read back. Otherwise `quality.md` names the blocked adapter step.
