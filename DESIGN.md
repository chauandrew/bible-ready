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
  database, no serverless functions. Free-tier Vercel hosting. One scoped
  exception: Question of the Day calls Supabase directly from the browser —
  see the "Question of the Day" bullet under Known gaps below.
- **Content is developer-authored JSON**, validated by Zod (`content/schema.ts`)
  and a build-time gate (`scripts/check-content.ts`, run via `npm run
  check:content`). Nothing user-generated at runtime.
- **Progress is `localStorage`** (`lib/progress.ts`) — per-device, no accounts,
  no sync.

## The events backbone

`events.json` is the keystone of every book. One event record —
`{ id, chapter, name, shortName?, citation, place?, peopleIds, order, summary,
notable }` — feeds four different question templates (which chapter, where,
who's involved, put these in order) instead of that fact being authored four
separate times. Adding a new book means authoring events once; the generator
does the rest.

**Coverage depth is set per book**, not assumed uniform:
- `"narrative"` — contiguous chapters 1..chapterCount, dense event coverage
  (2–3 events/chapter). Genesis, Exodus.
- `"selection"` — a curated, non-contiguous subset of a much longer book (e.g.
  19 famous psalms out of 150), *or* a curated cross-reference collection with
  no single underlying book at all (`famous-12s`: the twelve disciples, the
  twelve tribes, Romans 12, 1 Corinthians 12 — see below). `chapterCount` is
  the count of curated chapters, not a chapter number ceiling. Arcs group
  chapters *thematically* via each chapter's `arcId` — the authoritative
  membership signal — not by a numeric range (`arc.startChapter`/`endChapter`
  is display metadata only for a selection book, since a thematic group isn't
  contiguous). `check:content` skips the contiguity rules for this depth. One
  event per chapter by default, not split into sub-events by section — see
  the authoring rule below for the enumerated-list exception.
- `"sparse"` / `"argument"` — declared in the schema for books with much lower
  event density (law, genealogy) or epistles (argument-beat structure instead
  of narrated events). Not yet exercised by real content. Revisit this list
  once a law book or an epistle actually gets authored; the categories are a
  guess at this point, not a proven taxonomy.

**A `"selection"` module doesn't have to be a subset of one real book.**
`famous-12s` proves this: every event/quote in a book's content directory
must cite that book's own id (`check:content`'s "every item must belong to
the book whose directory it lives in" rule), so `famous-12s`'s citations all
read `"Famous 12s 3"`, not `"Romans 12"` — a deliberate, accepted tradeoff for
the two chapters (Romans 12, 1 Corinthians 12) that *do* have one real source
passage. The other two chapters (the twelve disciples, the twelve tribes)
never had one canonical citation to begin with — a disciple list drawn from
Matthew 10 and a tribal blessing from Genesis 49 aren't really "about" a
single verse the way a Genesis event is. If citation accuracy for the
real-passage chapters ever matters more than reusing the existing book/quiz
engine, the fix is a new content type that lets each item carry its own real
citation into whatever book it's from — a bigger lift, deliberately not built
for this first thematic module.

**`Book.chapterLabel`** (defaults to `"chapter"`) is the other piece this
required: `famous-12s`'s four numbered units aren't Bible chapters at all, so
every UI string that says "chapter(s)" — the chapters-index heading and
count, the arc page's count, the book-home overview blurb, the generated
"In which chapter does this happen" / "Which chapter" / "Review chapters"
quiz strings — reads `book.chapterLabel` instead of hardcoding the word.
`famous-12s` sets it to `"section"`. Genesis, Exodus, John, and Psalms don't
set it, so they're unaffected — Psalms' curated chapters *are* real Bible
chapters, unlike `famous-12s`'s. Note this only fixes the single-book quiz
(`/[book]/quiz`); the whole-Bible combined quiz's results breakdown
(`CategoryBreakdown`) aggregates by mechanic type across every selected book
at once, so it can't say "section" for one book's items and "chapter" for
another's in the same list — it always says "chapter" there, a deliberate
scope boundary, not an oversight.

## The question generator

Two distinct authorship modes, both feeding the same quiz pool
(`lib/quiz.ts`'s `selectQuiz`):

- **Generated** (`lib/generate.ts`) — derived mechanically from
  events/quotes/chapters at *runtime*, from a seed (`?s=` in the quiz URL, so
  a quiz is replayable and shareable). Six templates: which chapter, where,
  who says this, what's this chapter about, put these in order, match pairs.
  "Which chapter" is free-response (a book + chapter number), not multiple
  choice — see the partial-credit note below.
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

**"Which chapter" is free-response with partial credit, not multiple choice.**
The player types a book and a chapter number (`components/QuestionTypes.tsx`'s
`ChapterGuessQuestion`) rather than picking from four options — there's no
distractor pool to build or validate, so `generateChapterQuestions` is
considerably simpler than the other MC templates. `lib/quiz.ts`'s `pointsFor`
scores it out of 1: full credit for an exact match, half credit for the right
book landed exactly one chapter off (a near miss on numbering, not on knowing
the material), zero for anything else — including the right chapter number in
the *wrong* book, which isn't "close" at all. This is the one place
`ScoreResult.correct` can be fractional (e.g. `7.5/10`); `gapReport`'s
per-category breakdown stays binary (partial credit still counts as "wrong"
there, since it's a coaching signal about mastery, not the score itself).

**Quiz and Diagnostic are one flow, not two.** There used to be a separate
fixed-25-question "Diagnostic" with its own pages and a fixed (non-random)
seed, so retaking it was comparable to a prior attempt. That's gone: every
Quiz run (`components/QuizSetup.tsx`/`MultiQuizSetup.tsx`) now picks a
question count (5/10/15/25) and which sections (arcs) to draw from, always
uses a fresh random seed, and always shows the diagnostic's old "where to
focus" category breakdown (`components/CategoryBreakdown.tsx`, fed through
`QuizRunner`'s `resultsExtra` slot) at the end. `lib/content.ts`'s
`dataForArcsInBook` generalizes what used to be single-arc-or-all scoping
(`dataForModuleInBook`, still used as-is by the Print worksheet feature,
which only ever needs one arc or the whole book) to an arbitrary subset of
arcs. Since a static-export site can't pre-generate a page per arc-subset
combination, `/[book]/quiz` and `/quiz/bible` are single pages that build the
seed/count/sections into the URL query string client-side, the same pattern
the seed itself already used.

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
("what happens in chapter N?"). Not every chapter deserves this treatment —
genealogies and secondary chapters get skipped. This is a considered do-over
of `Event.notable`, which shipped as a boolean nobody ever set to `false` and
so did nothing (see Known gaps).

**Free-response grading terms come straight from the chapter's own
`title` + `summary`, not a separately-authored keyword list.**
`lib/grade.ts`'s `deriveGradingTerms` strips stopwords from both fields and
matches an answer against the result (typo-tolerant fuzzy word matching, same
as before) — there's nothing to keep in sync by hand for the common case, and
nothing for a chapter's own headline term to silently fall out of. The only
thing worth authoring is `Chapter.freeResponseAliases`: a short list for a
well-known alternate name that isn't textually present in either field (e.g.
`["palm sunday", "jerusalem"]` for a chapter titled "The Triumphal Entry",
whose summary never uses either word). `check:content` warns if a quizWorthy
chapter derives fewer than 3 significant terms total, since that makes
`minTerms` degenerate toward requiring nearly all of them.

**`Event.shortName` is a flashcard headline, not a quiz fact.** A few words
(e.g. `"The flood"` for an event named `"The flood covers the whole earth"`),
allowed to repeat across events since several chapters can share a topic.
Unlike `name`, it has no distinctness requirement — the generator never reads
it, only `FlashcardDeck` display does. Falls back to `name` when absent, so
it's fine to leave unset until a book's decks are actually authored.

**For a `"selection"` book, one `Event` per chapter — not split by section —
*unless the chapter is itself an enumerated list.*** A curated single-chapter
unit (a psalm, say) is one poem, not a narrative with discrete beats;
splitting it into per-section events (an "opening theme" event and a "closing
theme" event) mismatches the model events.json is built for. That event's
citation should omit `verses` entirely so it reads as `"Psalm 150"`, not
`"Psalm 150:1-6"` — the citation is the whole chapter, not a partial range.
Its `shortName` should be a key verse or part of one (e.g. `"The Lord is my
shepherd"` for Psalm 23) rather than a paraphrase — pick the chapter's most
recognizable line.

The exception: `famous-12s` (see below) has chapters that are themselves lists
of twelve named things (the twelve disciples, the twelve tribes), not a single
poetic unit. Forcing those into one event per chapter would make each member
unnamed and un-flashcardable — so those two chapters break the "one event"
rule deliberately, one event per named member, each tagged to its own
`Person` entry for the fuller bio. Romans 12 and 1 Corinthians 12, by
contrast, are real single chapters with real internal sub-themes, so they're
authored the normal "narrative" way (2-3 events per chapter, like Genesis or
John) rather than as a curated single unit.

**Distractor option casing must be consistent within a pool.** Any field that
feeds MC options (`place`, chapter titles, etc.) must be capitalized the same
way across a book — one lowercase-initial option sitting next to capitalized
ones lets a test-taker spot the answer by formatting, not by knowing the
material. These strings are only ever displayed as standalone list items
(never embedded mid-sentence), so always capitalize the first letter.

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
- **Multi-book UI wiring**: Genesis, Exodus, Psalms, John, and Famous 12s each
  have a full section (`app/[book]/*` — home, chapters, people, arcs, quiz,
  flashcards, print), gated by `wiredBookIds` in `lib/content.ts`. The
  homepage groups these under "Study one module" rather than "Study one
  book," since Famous 12s isn't a book — it's a cross-reference collection
  (see the `coverageDepth` note above) — but it's wired exactly like any
  other book underneath. Psalms' `coverageDepth: "selection"` needed page
  treatment a `"narrative"` book doesn't (and `famous-12s` reuses this same
  treatment, being `"selection"` too): `app/[book]/study/chapters/page.tsx` and
  `app/[book]/study/arcs/[id]/page.tsx` show a chapter count instead of
  `arc.startChapter`–`endChapter` (a selection book's arcs are thematic and
  overlapping, so the range is display metadata, not a real span — see the
  content authoring rules above), and
  `app/[book]/study/chapters/[number]/page.tsx`'s prev/next links walk the
  book's chapter list by index instead of `chapter.number +/- 1`, since a
  curated chapter list (Psalm 1, 8, 19...) isn't contiguous. A future
  `"sparse"` or `"argument"` book reuses the same `coverageDepth` branch.
  Adding a book to `wiredBookIds` alone isn't enough — `lib/content.ts` also
  needs a static import + `BookContentSchema.parse` + `booksContent` entry
  for it (see the block for any existing book), and `app/page.tsx`'s
  `available` list is hand-maintained, not derived from `wiredBookIds`, so a
  new book needs a card added there too.
- **No offline/PWA support.** Deliberately skipped for v1 — revisit if it's
  actually requested.
- **Question of the Day (`/qotd`)** has one deterministic daily question
  (`selectDailyQuestion` in `lib/quiz.ts`, seeded off a Pacific-time date
  string the same way `selectQuiz`/`selectQuizMulti` seed off a URL param),
  a local timer, and a results screen. Answering it also submits to
  Supabase (`supabase/migrations/0001_qotd.sql`) and shows the day's shared
  percentile — the only place in this app that calls a database. This is
  safe with a public anon key the same way a Stripe publishable key is
  public: the key only identifies the project, and Postgres Row Level
  Security enforces access server-side, defaulting to zero access until a
  policy explicitly grants it. There's deliberately no SELECT policy on the
  raw `qotd_responses` table (a `device_id` is a stable pseudonymous
  identifier — letting anon `SELECT *` would let anyone scrape everyone's
  id/time/correctness for the day); the client only ever reads aggregates,
  returned by two `SECURITY DEFINER` functions (`qotd_submit_and_score`,
  `qotd_my_result`). The `(play_date, device_id)` unique constraint is the
  entire anti-cheat mechanism — deliberately light, soft/best-effort since
  there are no accounts. Clearing `localStorage` resets both the local
  cache and the device id, so a determined user can always replay; that's
  an accepted tradeoff, not a bug.

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
   for this book — grading terms derive automatically from `title` +
   `summary`, so there's nothing else to author unless a chapter's common
   nickname isn't textually present in either, in which case add it to
   `freeResponseAliases`.
7. If any chapters feed a flashcard deck, author `Event.shortName` for those
   events — a key verse or short headline, not a copy of `summary`. For a
   `"selection"` book, that means one event per chapter with no `verses` on
   its citation (see the authoring rule above), not one event per section.
8. `npm test`, `npx tsc --noEmit`, `npx eslint .`, `rm -rf .next && npm run
   build` — all four, not just `check:content`.
