# Bible Ready

A Bible study and quiz app (Genesis, Exodus, 1-2 Samuel, Ezra, Psalms, John,
Galatians), built for youth ministry
leaders and the high schoolers they teach. Domain knowledge over trivia: what
happens, where, and to whom — not theological debate.

Static site, no backend, no database — with one scoped exception: Question of
the Day (`/qotd`) calls Supabase directly from the browser to record answers
and show a shared daily percentile. Everything else stays backend-free.
Content is developer-authored JSON validated by Zod. Progress is tracked in
the browser via `localStorage`.

## Develop

```bash
npm install
npm run dev
```

Every page except `/qotd` works with no configuration. To exercise Question
of the Day locally, create a Supabase project (see `supabase/migrations/0001_qotd.sql`
for the schema to run), then add a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Without it, `lib/supabase.ts` only throws when a QOTD submit/fetch call is
actually made — the rest of the app is unaffected, and `/qotd` itself still
loads and shows the question, it just can't save an answer or show a
percentile.

## Content

Each book's content lives in `content/<book>/*.json`, validated against
`content/schema.ts`. Quiz questions come from two sources:

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

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, "Add New Project" and import the repo.
3. In the project's Settings → Environment Variables, add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (all
   environments) so Question of the Day works on the deployed site. `NEXT_PUBLIC_*`
   vars are inlined at build time, so this must be done before the first
   build that needs them.
4. Vercel auto-detects Next.js, runs `npm run build`, and serves the static
   `out/` directory produced by `output: "export"`. No other project
   settings need to change.

No `vercel.json` is included on purpose: this is a plain static export with
no functions, no redirects, and no headers that need overriding, so Vercel's
zero-config static-site handling (including the auto-generated 404 page) is
enough. Add one later only if a real need shows up (custom headers,
redirects, etc.).

[Vercel Analytics](https://vercel.com/docs/analytics) and
[Speed Insights](https://vercel.com/docs/speed-insights) are wired into
`app/layout.tsx`. Both only report data when served from a Vercel domain —
they no-op in local dev and in the static `out/` build.
