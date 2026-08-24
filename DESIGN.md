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
  19 famous psalms out of 150), *or* a fully hand-curated module with no
  single underlying book at all (`misc`, displayed as "Miscellaneous":
  the twelve disciples, the twelve tribes of Israel, the Old Testament books
  in order, the New Testament books in order — see below). `chapterCount` is
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
`misc` proves this: every event/quote in a book's content directory
must cite that book's own id (`check:content`'s "every item must belong to
the book whose directory it lives in" rule), so its citations all read
`"Miscellaneous 1"`, not "Matthew 10" or "Genesis 49" — none of its four
sections (the twelve disciples, the twelve tribes of Israel, the Old
Testament in order, the New Testament in order) is really "about" one real
verse or chapter the way a Genesis event is, so there's no citation accuracy
being traded away here. If a future thematic module *did* need to cite a real
passage per item, the fix would be a new content type that lets each item
carry its own real citation into whatever book it's from — a bigger lift,
not needed by anything currently authored.

**`Book.autoGenerate`** (defaults to on) is for a module like this one whose
chapters aren't narrative prose the generic per-event/per-chapter templates
can ask a sensible question about — "which chapter/section does this happen
in" or "what is section 1 about" don't mean anything for "the twelve
disciples." Turning it off suppresses `generateChapterQuestions`/`Location`/
`Speaker`/`ChapterSummary` (and their ambiguity checks in `findAmbiguities`)
for the whole book; free-response and sequence generation are unaffected,
since those are already opt-in per chapter (`quizWorthy`) and per arc
respectively. `misc` is the only book that sets this `false` — every
question it offers is either a hand-tuned free-response roster or a
put-in-order sequence, both described below.

**`Book.chapterLabel`** (defaults to `"chapter"`) is the other piece a module
like this needs: `misc`'s four numbered units aren't Bible chapters at
all, so every UI string that says "chapter(s)" — the chapters-index heading
and count, the arc page's count, the book-home overview blurb, the generated
"In which chapter does this happen" / "Which chapter" / "Review chapters"
quiz strings — reads `book.chapterLabel` instead of hardcoding the word.
`misc` sets it to `"section"`. Genesis, Exodus, John, and Psalms don't
set it, so they're unaffected — Psalms' curated chapters *are* real Bible
chapters, unlike `misc`'s. Note this only fixes the single-book quiz
(`/[book]/quiz`); the whole-Bible combined quiz's results breakdown groups by
book name instead (see `QuizRunner`'s `categorize` prop below), so the
"section" vs "chapter" wording question doesn't come up there at all.

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
The player types a book name and a chapter number as plain text
(`components/QuestionTypes.tsx`'s `ChapterGuessQuestion`) rather than picking
from four options or a book `<select>` — there's no distractor pool to build
or validate, so `generateChapterQuestions` is considerably simpler than the
other MC templates. The typed book name is resolved case-insensitively, with
one-edit-distance typo tolerance ("gensis" still matches Genesis), by
`lib/content.ts`'s `matchBookName`, which reuses the same fuzzy word matcher
as free-response grading (`lib/grade.ts`'s `wordMatches`) rather than a
second implementation; an unmatched or made-up book name just resolves to no
book and scores as an ordinary wrong answer, not an error. `lib/quiz.ts`'s
`pointsFor` scores it out of 1: full credit for an exact match, half credit
for the right book landed exactly one chapter off (a near miss on numbering,
not on knowing the material), zero for anything else — including the right
chapter number in the *wrong* book, which isn't "close" at all.

**Sequence and match questions score 0.5 per correct option/pair, uncapped —
not the flat 1-or-0 every other item type gets.** A 6-item "put these in
order" question with 3 in their right position scores 1.5; a 4-pair matching
question with 3 correct pairs scores 1.5. `lib/quiz.ts`'s `maxPointsFor(item)`
is 1 for every item type except these two, where it's `optionCount * 0.5` —
so a single sequence/match item can outweigh several ordinary ones, and a
quiz's total possible score is no longer just its item count. `pointsFor`
compares position-by-position for sequence (`answer.order[i] ===
item.correctOrder[i]`) and pair-by-pair for match, independent of
`isCorrect`, which still means "every position/pair right" (used for the
missed-question bank and QOTD, which stays strict/binary on purpose — see the
"Question of the Day" bullet under Known gaps). This is why `ScoreResult`
tracks both `correct` (sum of `pointsFor`) and `total` (sum of
`maxPointsFor`) rather than assuming `total === items.length` — `scoreQuiz`'s
"Score: X/Y" can now show e.g. `8.5/12` for a 10-question quiz that included
one 6-item sequence question.

**"Where to focus" groups by a caller-supplied categorizer, not a fixed
mechanic/theme key.** `gapReport(items, answers, categorize)` takes a
`(item) => string` and buckets right/wrong by whatever it returns — still
binary (`points >= maxPointsFor(item)` counts as right, same "coaching
signal, not the score" reasoning as before) even though `pointsFor` itself is
fractional. `QuizRunner`'s `categorize` prop defaults to
`categorizeByBook` (groups by book name — right for a quiz spanning several
books, via `MultiQuizSetup`), while a single-book quiz (`QuizSetup`) passes
an arc-based categorizer built from `lib/content.ts`'s `arcNameForChapter`,
since "which book" is a useless distinction when there's only one in play but
"which section of this book" (Creation, The fall, Noah and the flood...) is
exactly the "what do I need to study more" signal the feature is for.
`CategoryBreakdown` no longer has a label-lookup dictionary — the category
string it's given (an arc name or a book name) is already what gets
displayed, unlike the old `mechanic:location` / `theme:covenant` keys.

**"Put these in order" caps at 6 items by default, configurable per arc.**
`generateSequenceQuestions` sorts an arc's notable events by
(chapter, order) and slices to `arc.sequenceLimit ?? 6` — six is a UI
judgment call (a tap-to-place list gets unwieldy past that for a normal
narrative arc), not a hard constraint, so an arc that genuinely *is* the
content being ordered can raise it. `misc`'s Old Testament and New
Testament sections do exactly this (`sequenceLimit: 39` / `27`) to produce
one "put the whole thing in order" question instead of splitting into several
partial ones. The generated prompt still says "Put these **events** from..."
even for a book list — not worth a second schema field just for that noun.

**Revisiting an already-answered question via "Previous" is fully editable,
not read-only.** Each question-type component (`components/QuestionTypes.tsx`)
takes an `initialAnswer` prop and seeds its local state from it on (re-)mount
— `McQuestion` highlights the prior pick without locking the other options,
`SequenceQuestion`/`MatchQuestion` pre-fill the placed order/pairs using their
existing tap-to-undo interaction (match gained the same undo affordance
sequence already had, for this), `ChapterGuessQuestion`/`FreeResponseQuestion`
pre-fill the text fields. Only the *resolved* chapter-guess book id is stored
in `Answer`, not the raw text originally typed, so a revisit shows the book's
canonical name rather than whatever phrasing/typo produced it — a minor,
accepted loss of fidelity. Changing and resubmitting an answer replaces it
and auto-advances, identical to answering for the first time; there's no
separate "confirm the change" step, by design, to keep one consistent rule.

**Quiz and Diagnostic are one flow, not two.** There used to be a separate
fixed-25-question "Diagnostic" with its own pages and a fixed (non-random)
seed, so retaking it was comparable to a prior attempt. That's gone: every
Quiz run (`components/QuizSetup.tsx`/`MultiQuizSetup.tsx`) now picks a
question count (5/10/15/25), always uses a fresh random seed, and always
shows the diagnostic's old "where to focus" category breakdown
(`components/CategoryBreakdown.tsx`, fed through `QuizRunner`'s
`resultsExtra` slot) at the end. The two setup screens differ in picker
granularity, deliberately: a single-book quiz (`QuizSetup`) still lets you
pick which sections (arcs) of that one book to draw from, via
`lib/content.ts`'s `dataForArcsInBook` (an arbitrary subset of arcs, unlike
`dataForModuleInBook`'s one-arc-or-all, still used as-is by the Print
worksheet feature); the whole-Bible quiz (`MultiQuizSetup`) only lets you
pick *which books* (`dataForBooks`, always the whole book) — a checkbox per
arc per selected book was too many options to scan at that scale, and
"which sections of Genesis" is a much less useful question to ask when
Genesis is one of several books in the mix anyway. Since a static-export site
can't pre-generate a page per arc-subset combination, `/[book]/quiz` and
`/quiz/bible` are single pages that build the seed/count/selection into the
URL query string client-side, the same pattern
the seed itself already used.

**Revisiting an already-answered question in Quiz mode is read-only.**
`QuizRunner`'s "← Previous" button lets a player look back at any question,
but each question component remounts fresh via `key={item.id}` when the
index changes — it has no memory of what was picked before. In Quiz mode,
answering commits and auto-advances on a single click with no confirmation,
so without a guard, going back and clicking anything (even by accident)
silently overwrote the original answer, and the post-quiz review showed the
new one with no sign it had changed. `QuizRunner` now checks for an existing
`Answer` by `item.id` and, in Quiz mode only, renders a locked "Already
answered: ..." view (`lib/quiz.ts`'s `userAnswerText`) with a Next button
instead of the live question. Study mode is deliberately exempt — retrying a
question there to practice is the intended behavior, not a bug.

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

**A chapter whose free-response question is a fixed roster, not prose,
overrides both the prompt and the threshold.** "Name the twelve disciples"
isn't "describe this chapter in your own words" — the terms *are* the
answer (a name per disciple), and the global `minTerms` default (3) would
pass someone who named three disciples and stopped. `Chapter.freeResponsePrompt`
replaces the generated "what happens in..." prompt text, and
`Chapter.freeResponseMinTerms` replaces the derived threshold outright.
`misc`'s disciples/tribes chapters use `freeResponseAliases` for the
whole roster (there's no prose title/summary to derive real names from) with
a threshold a few short of the total, and lean on presence-based (not
consuming) term matching for a deliberate leniency: listing a shared,
ambiguous name once (e.g. "Judas" for either Judas Iscariot or the
otherwise-obscure "Judas son of James," authored here as "Thaddaeus") credits
whichever slot it satisfies rather than penalizing the player for not
disambiguating two apostles almost nobody keeps straight — same idea as
accepting "Ephraim"/"Manasseh" in place of "Joseph" among the twelve tribes,
since both are correct depending which enumeration you learned.

**`Event.shortName` is a flashcard headline, not a quiz fact.** A few words
(e.g. `"The flood"` for an event named `"The flood covers the whole earth"`),
allowed to repeat across events since several chapters can share a topic.
Unlike `name`, it has no distinctness requirement — the generator never reads
it, only `FlashcardDeck` display does. Falls back to `name` when absent, so
it's fine to leave unset until a book's decks are actually authored. A
flashcard is one per *chapter*, not one per event — `lib/content.ts`'s
`cardsForEventIds` groups a card set's events by `Event.chapter` (preserving
`Event.order` within each group) and renders every constituent event as its
own `shortName`/`summary` point on that chapter's single card, so a chapter
with several notable events (or an enumerated `misc` chapter like the twelve
disciples) shows one card with multiple points instead of several
near-duplicate cards sharing the same citation.

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

The exception: `misc` (see below) has chapters that are themselves lists
of named things — the twelve disciples, the twelve tribes, the books of the
Old and New Testaments — not a single poetic unit. Forcing those into one
event per chapter would make each member unnamed and un-flashcardable (for
the disciples/tribes) or impossible to sequence (for the OT/NT books, whose
sequence question needs one event per book) — so all four chapters break the
"one event" rule deliberately, one event per named member. The disciples and
tribes are each tagged to their own `Person` entry for the fuller bio; the
OT/NT book events aren't (no `Person` record exists for "the book of
Leviticus"), so those events omit `peopleIds` and set `notable: true` purely
so `generateSequenceQuestions` picks them up, while the disciples/tribes
events set `notable: false` — they exist for the flashcard decks and the
chapter's event list, not to be swept into an unwanted auto-generated
sequence question of their own (see `Book.autoGenerate` above; the same
individual-event `notable` flag matters again here).

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

- **`Event.notable`** was a no-op for a long time (every authored event in
  every book set it `true`, so every `.filter(e => e.notable)` in the
  generator did nothing). It now has real, deliberate meaning in
  `misc`: the disciples/tribes events set it `false` specifically to
  keep them out of `generateSequenceQuestions`'s pool (see the enumerated-list
  exception above), while the OT/NT book events set it `true` so they *are*
  picked up. Genesis, Exodus, John, and Psalms still set it `true` on every
  event, unchanged — this remains something only a fully hand-curated module
  needs to reach for.
- **Multi-book UI wiring**: Genesis, Exodus, Psalms, John, and misc
  (displayed as "Miscellaneous") each have a full section (`app/[book]/*` —
  home, chapters, people, arcs, quiz, flashcards, print), gated by
  `wiredBookIds` in `lib/content.ts`. The homepage groups these under "Study
  one module" rather than "Study one book," since Miscellaneous isn't a
  book — it's four unrelated hand-curated lists (see the `coverageDepth` note
  above) — but it's wired exactly like any other book underneath. Psalms'
  `coverageDepth: "selection"` needed page treatment a `"narrative"` book
  doesn't (and `misc` reuses this same treatment, being `"selection"`
  too): `app/[book]/study/chapters/page.tsx` and
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
   `freeResponseAliases`. A chapter whose free-response answer is a fixed
   roster rather than prose (see `misc`'s disciples/tribes chapters)
   instead sets `freeResponsePrompt` and `freeResponseMinTerms` explicitly.
7. If any chapters feed a flashcard deck, author `Event.shortName` for those
   events — a key verse or short headline, not a copy of `summary`. For a
   `"selection"` book, that means one event per chapter with no `verses` on
   its citation (see the authoring rule above), not one event per section.
8. `npm test`, `npx tsc --noEmit`, `npx eslint .`, `rm -rf .next && npm run
   build` — all four, not just `check:content`.
