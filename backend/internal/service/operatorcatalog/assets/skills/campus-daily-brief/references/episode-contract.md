# Episode Contract

One episode is one listening day for campus staff and students.

## Hosts

- Female host: 甜甜 (`speaker: female`)
- Male host: 糖糖 (`speaker: male`)

甜甜 opens. 糖糖 follows with a one-line role intro, then they alternate.

## Opening

Preserve the packaged opening verbatim, including Gregorian date, weekday,
and lunar date:

```text
【开场白】
大家好，欢迎收听甜甜60秒，我是主播甜甜。今天是{YYYY年M月D日} {星期X}，{农历…}。
```

Do not rewrite the date line. Holiday greetings, if any, come after this
opening, not instead of it.

## Sections

Package source items as:

```text
【开场白】
...
【新闻部分】
...
【通知部分】
...
```

If there is no news, the news section is `暂无新闻`. Do not invent items.
Split news vs notices by source column or title keywords (`通知` / `公示`
/ `公告`) when the fetch adapter does not already classify them.

## Length

Spoken runtime target is 60–90 seconds. Cover every item; compress wording
instead of dropping articles.
