# Design notes

Why things are shaped the way they are. Not a changelog — `git log` already has
that. This is the reference to read before adding a new book or a new question
type, and to update when a decision here stops being true.

## Product goal

Domain knowledge over trivia. Questions test the main events, people, places,
and narrative arc of a book — not incidental detail (what wood the ark was
built from) and not seminary-level theological debate. Audience is young adult
church leaders (23–40) doing youth ministry, plus the high schoolers they
teach.

## Architecture at a glance

- **Static export** (`output: "export"` in `next.config.ts`). No backend, no
  database, no serverless functions. Free-tier Vercel hosting.
- **Content is developer-authored JSON**, validated by Zod (`content/schema.ts`)
  and a build-time gate (`scripts/check-content.ts`, run via `npm run
  check:content`). Nothing user-generated at runtime.
- **Progress is `localStorage`** (`lib/progress.ts`) — per-device, no accounts,
  no sync.

## The events backbone

`events.json` is the keystone of every book. One event record —
`{ id, chapter, name, citation, place?, peopleIds, order, summary, notable }`
— feeds four different question templates (which chapter, where, who's
involved, put these in order) instead of that fact being authored four
separate times. Adding a new book means authoring events once; the generator
does the rest.

**Coverage depth is set per book**, not assumed uniform:
- `"narrative"` — contiguous chapters 1..chapterCount, dense event coverage
  (2–3 events/chapter). Genesis, Exodus.
- `"selection"` — a curated, non-contiguous subset of a much longer book (e.g.
  18 famous psalms out of 150). `chapterCount` is the count of curated
  chapters, not a chapter number ceiling. Arcs group chapters *thematically*
  via each chapter's `arcId` — the authoritative membership signal — not by a
  numeric range (`arc.startChapter`/`endChapter` is display metadata only for
  a selection book, since a thematic group isn't contiguous). `check:content`
  skips the contiguity rules for this depth.
- `"sparse"` / `"argument"` — declared in the schema for books with much lower
  event density (law, genealogy) or epistles (argument-beat structure instead
  of narrated events). Not yet exercised by real content — Genesis and Exodus
  are dense narrative, Psalms is a selection. Revisit this list once a law
  book or an epistle actually gets authored; the categories are a guess at
  this point, not a proven taxonomy.

## The question generator

Two distinct authorship modes, both feeding the same quiz pool
(`lib/quiz.ts`'s `selectQuiz`):

- **Generated** (`lib/generate.ts`) — derived mechanically from
  events/quotes/chapters at *runtime*, from a seed (`?s=` in the quiz URL, so
  a quiz is replayable and shareable). Six templates: which chapter, where,
  who says this, what's this chapter about, put these in order, match pairs.
- **Authored** (`questions.json`) — hand-written thematic questions (arc,
  covenant, character, theme, argument) that a template can't produce. A
  module falls back to generated-only when a book has no authored items yet.

**Why runtime generation is safe**: ids are deterministic, derived from the
underlying fact (`gen:location:evt-abc`), never from the seed. `check:content`
runs the generator *exhaustively* over the whole corpus at build time and
fails if any generated item would be ambiguous, so what ships to a player is
always a member of an already-proven-clean set — the runtime seed only picks
*which* clean items appear and shuffles their options, it never produces a new
kind of item that wasn't already validated.

**Distractor pools need `>= 3` distinct wrong answers.** This is the load-
bearing constraint behind several content rules below — an arc with too few
distinct values for some field (place, speaker, chapter title) simply
generates zero questions of that type for that arc, rather than getting
padded with a fake option to hit the number. Zero questions of one type in a
small arc is correct; a manufactured fourth option is not.

## Content authoring rules (the ones that aren't obvious from the schema)

**`Event.place` is optional, and that's deliberate.** Most events aren't
"about" a place — set it only when the location is itself part of the
narrative (arriving in Egypt, crossing the Red Sea, a named divine-encounter
site) not routine continuation in an already-established setting (tagging
every plague "Egypt" once Egypt is already the scene makes the question
trivially guessable). For a `"selection"` book like Psalms, `place` gets
repurposed as an "occasion/type" fact instead of geography — psalms aren't
narrated scenes — but the same distinctiveness bar applies: a generic genre
label ("a wisdom psalm") that repeats across an arc isn't worth keeping,
a specific fact (Psalm 90 is the only psalm the heading attributes to
Moses) is.

**Chapter summaries are length-banded (15–45 words), on purpose.** If some
summaries run long and others short, a generated "what is chapter N about"
question leaks the answer by length alone, since the options are chapter
titles/summaries sitting next to each other. `check:content` enforces the
band; keep new content inside it.

**Event names must not contain their own answer.** "Abram builds an altar at
Shechem" as an event name defeats its own "where does this happen" question.
`check:content` warns (not fails — these degrade to "no question generated
for this event," which is fine) when a place string is literally substring-
matched inside its event's name.

**Authored-question option lengths are gated.** The correct option being the
single longest across a book's authored questions must stay under 50%, or
"pick the longest" becomes a viable strategy independent of knowing the
material. Write distractors with real content, not short strawmen — a
distractor should be a complete, plausible-sounding wrong answer, not "he
refuses to say" three words long next to a correct answer three sentences
long.

**ESV verses are individual and budget-tracked.** Quotes are single verses
only (never a range), never two verses back-to-back in the same chapter (the
Crossway grant is for individual verses, not passages), and stay under a hard
cap tracked in `VERSE_COUNTS` per book in `check-content.ts`. Add a book's
real verse count there before authoring quotes for it, or the budget check
silently no-ops for that book.

**`Chapter.quizWorthy` gates the free-response question type**
("what happens in chapter N?", graded by keyword-group fuzzy matching — see
`lib/grade.ts`). Not every chapter deserves this treatment — genealogies and
secondary chapters get skipped. This is a considered do-over of `Event.notable`,
which shipped as a boolean nobody ever set to `false` and so did nothing (see
Known gaps).

## Theming

`app/globals.css` defines the whole palette as CSS variables on `:root`
(light) and `:root[data-theme="dark"]` / `prefers-color-scheme` (dark). No
component hardcodes a color. Swapping the entire visual identity later is a
one-file change. `suppressHydrationWarning` on `<html>` is required because
the theme-flash-prevention inline script intentionally mutates `data-theme`
before React hydrates — that's expected, not a bug to "fix" by removing it.

## Known gaps / deliberately deferred

- **`Event.notable`** exists in the schema but every authored event across
  every book sets it `true`, so every `.filter(e => e.notable)` in the
  generator is currently a no-op. `Chapter.quizWorthy` is the first real use
  of this kind of curation flag, at the chapter level. Either give `notable`
  real meaning at the event level too, or remove it — don't leave a third
  copy of an unused boolean lying around.
- **Multi-book UI wiring is incomplete.** `lib/content.ts` loads Genesis
  directly; Exodus and Psalms content is fully authored and passes
  `check:content`, but isn't reachable from the running app yet (the home
  page lists them as "Coming soon" on purpose). Generalizing `lib/content.ts`
  to load whichever books exist and generating routes per book is the next
  real architectural step, not a bug.
- **No offline/PWA support.** Deliberately skipped for v1 — revisit if it's
  actually requested.

## Checklist: adding a new book

1. Decide `coverageDepth` first — it determines whether chapters need to be
   contiguous and whether arcs are ranges or thematic groups.
2. Add the book's real verse count to `VERSE_COUNTS` in
   `scripts/check-content.ts` before authoring any quotes.
3. Author in this order, cross-referencing ids forward: `book.json` →
   `arcs.json` → `chapters.json` → `events.json` (peopleIds must already
   exist) → `people.json` → `quotes.json` (speakerId must exist) →
   `questions.json` → `decks.json`.
4. Run `npm run check:content` after every file, not just at the end — it's
   cheap and catches a dangling reference immediately instead of after the
   whole corpus is written.
5. Only set `Event.place` on genuinely narrative/occasion-significant events,
   and check that every arc with any `place` set has at least 4 distinct
   values (the generator's distractor floor) before moving on — this is the
   single most common thing to get wrong on a first pass.
6. Mark `Chapter.quizWorthy` selectively if you want free-response questions
   for this book, and author `freeResponse.keywordGroups` for each one you
   mark.
7. `npm test`, `npx tsc --noEmit`, `npx eslint .`, `rm -rf .next && npm run
   build` — all four, not just `check:content`.
