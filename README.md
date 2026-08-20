# Bible Ready

A study and quiz app for the book of Genesis, built for youth ministry leaders and
the high schoolers they teach. Domain knowledge over trivia: what happens, where,
and to whom — not theological debate.

Static site, no backend, no database. Content is developer-authored JSON validated
by Zod. Progress is tracked in the browser via `localStorage`.

## Develop

```bash
npm install
npm run dev
```

## Content

Genesis content lives in `content/genesis/*.json`, validated against `content/schema.ts`.
Quiz questions come from two sources:

- **Generated** — derived at runtime from `events.json`/`quotes.json`/`chapters.json`
  by `lib/generate.ts` (which chapter, where, who says it, what a chapter is about,
  event ordering, matching). Exhaustively validated at build time so nothing ambiguous
  ships.
- **Authored** — hand-written thematic questions in `questions.json` (themes, arcs,
  covenants, characters, the book's argument) that a generator can't produce.

Run the content gate before committing any content change:

```bash
npm run check:content
```

## Test

```bash
npm test
```

## Build

Fully static (`output: "export"` in `next.config.ts`) — no serverless functions.

```bash
npm run build
```
