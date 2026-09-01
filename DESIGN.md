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
`ChapterGuessQuestion` also takes an optional `singleBookId` (threaded
through `QuizRunner`, set by `QuizSetup` for a single-book quiz and by
`MultiQuizSetup` when only one book ended up picked): when set, the book
input disappears, the prompt drops its "book and" (a plain string replace,
since `generateChapterQuestions` always emits that exact phrase), and the
book half of the answer is filled in from `singleBookId` instead of typed
text, since it was never in question. The item's stored `prompt` itself
still always says "book and": it's generated per book with no way to know
whether it'll land in a single-book or combined quiz, so the shorter wording
is a render-time decision, not a second prompt variant.

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

## Chapter Order (a standalone, non-generated quiz)

`/[book]/chapter-quiz` (`components/ChapterOrderBoard.tsx`) tests whether a
player knows a book's overall shape (which chapter a given event/theme falls
in) rather than recall of one fact. Every chapter in the book gets a labeled
slot (by its real chapter number) and a shuffled card showing its
title+`blurb` (never its own number; falls back to `summary` if a chapter
has no `blurb` authored, see `Chapter.blurb`'s schema doc); the player drags
or clicks cards into slots and submits for a percentage score and a
per-chapter correct/incorrect review.

**Deliberately standalone**, not routed through `lib/generate.ts`/
`lib/quiz.ts`'s `QuizRunner` engine (`lib/chapterOrder.ts` has its own small
pure scoring/placement functions instead). That engine exists to build and
validate distractor pools for many small independently-gradable questions;
here every chapter is both a slot and a card, 1:1 by construction, so
there's no distractor pool and no ambiguity to check. `scripts/check-content.ts`
does still warn on one thing for this feature (see the `blurb` checklist step
below), but needs no ambiguity/distractor-pool logic the way the generated
templates do.

**Not wired into `lib/progress.ts`, on purpose.** Every other quiz calls
`recordSession`/`clearMissed` so its result feeds `/progress`'s session
history and best-score table, and a wrong answer enters `/practice`'s
missed-question bank. Chapter Order doesn't: that bank resolves saved ids
against the generated/authored `QuizItem` pools (`quizFromIdsMulti`), and a
chapter id has nothing to resolve to there, so recording one would just be a
dead entry nothing can ever practice. A `/progress` surface dedicated to
Chapter Order (its own best-score line, not folded into the existing bank)
is a reasonable future addition; it doesn't exist yet.

**Uses every chapter in the book, not just `quizWorthy` ones**: that flag
only gates the generated free-response "what happens in this chapter"
question (`lib/generate.ts`); it has no bearing here.

**Excluded for `Book.coverageDepth === "selection"` books** (Psalms, Misc):
their chapters are a curated, non-contiguous subset or thematic sections, not
sequential narrative, so "which slot is this from" isn't a meaningful
question, the same reasoning `generateSequenceQuestions` already uses to skip
non-contiguous arcs. Enforced by filtering `generateStaticParams` in
`app/[book]/chapter-quiz/page.tsx`, so the route is never built for those
books (not just hidden from `/[book]`'s review-tools list).

**Interaction: click places into a slot; drag also works.** Clicking an
unplaced card is the fast path for going roughly in order: it drops into the
next open slot. To target one exact slot instead (e.g. "David and Goliath is
definitely chapter 17" before you've placed anything else), click that empty
slot first to arm it, then click the card; the next pool-card click fills
the armed slot instead of the next open one. Dragging a card (from the pool,
or one already placed) onto any slot places it there directly, the same as
an armed click, and bumps that slot's previous occupant (if any) back to the
pool. All three paths funnel through the same `place`/`unplace` functions in
`lib/chapterOrder.ts`. No `dnd-kit` `KeyboardSensor`: it's built for a single
reorderable list (`SortableContext`), not ~50 independent drop targets, so
the arm-then-place click flow (plain focusable buttons throughout) is what
gives keyboard/screen-reader users the same exact-slot targeting drag gives
a mouse, without needing a custom keyboard coordinate-getter for a
non-sortable board.

**The shuffle order is seeded from the current time, not the book id**, so
replaying the same book doesn't always start with the same arrangement. That
seed can't be read during the render that has to match the static-export
server output (see the comment above `ChapterOrderBoard`'s `useState`/
`useEffect` pair): the board starts unshuffled (identical on the server
render and the client's first hydration pass) and reshuffles once, client-only,
in a mount effect. A fixed per-book seed (`mulberry32(hashSeed(bookId))`,
the pattern the rest of the app uses for reproducible shuffles) would avoid
that effect entirely, at the cost of every replay looking the same; not
chosen here since a fresh arrangement per attempt is the point.

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

**Restating the chapter's own title is always correct, even short of
`minTerms`.** A short title like "The Good Shepherd" contributes only 2
significant words of its own; the rest of `minTerms` has to come from the
summary's details (the door, the sheep, oneness with the Father...). An
answer that's exactly the chapter's famous line — "I am the good shepherd" —
is unambiguously right and shouldn't need to also describe details it never
claimed. `deriveGradingTerms` tracks title-derived terms separately
(`GradingTerms.titleTerms`), and `gradeFreeResponse` accepts an answer that
covers all of them regardless of the overall term count. This shortcut is
disabled (`titleTerms` comes back empty) for any chapter with an authored
`freeResponseMinTerms` — the roster chapters below set that specifically
because the title alone ("The Twelve Disciples") is *not* a sufficient
answer, and the shortcut would otherwise defeat that.

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

**Authored question prompts describe what happens, not what it means.**
"What does the flood narrative show about the relationship between human
wickedness and divine judgment?" and "What theme is reflected when Jacob
blesses the younger son ahead of the older?" ask the player to already know
the answer to name a literary theme — this is an easy pattern to slip into
when drafting a batch of questions, and it reads as generated rather than
authored. Prefer the concrete, plot-level version instead: "What curse does
God pronounce on the serpent after the fall?", "What does Jacob do when
Joseph presents his two sons for a blessing?" This isn't a ban on the
`category: "theme"` tag — it's about what the prompt itself asks for.
`1-samuel`/`2-samuel` are the model to match. A `"selection"` book (Psalms)
is a partial exception: an `"arc"`-category question grouping several psalms
by shared theme is unavoidable, since Psalms genuinely has no plot — but even
there, prefer asking about a specific verse, image, or occasion over naming
an abstract theme when one is available.

## Journeys — event-by-event map walkthroughs

A journey is a character arc that crosses several existing arcs (Abraham →
Isaac → Jacob → Joseph spans `abraham-call` through `joseph`, five arcs) and
walks it event by event with each stop plotted on a map. This is optional
per book — `journeys.json` doesn't exist for a book until it has one, and
`BookContent.journeys` defaults to `[]` so nothing else has to change.

**Data-driven for extensibility, on purpose.** A `Journey`
(`content/schema.ts`) doesn't re-author facts — each `JourneyStop` references
an existing `Event.id` and reads its name/summary/citation from
`events.json`; the stop only adds what's new: `characterIds` (whose path it's
on), `place` (the pin label), `lat`/`lng` (real-world coordinates), and an
optional `locationNote` for sites whose identification is disputed or
approximate. Adding a *new* journey to an *existing* book's `journeys.json`
needs no code change. Adding one for a *new* region (1-2 Samuel's Saul/David
story, say) needs no new map asset either — the same bundled world
coastline/river/lake data covers any region; only `bounds` in
`JourneyExplorer` (derived from the journey's own stops) changes. A brand
new *era* string is a little more work but still no new base map data:
Ezra's `"return"` era (two journeys — the first return under Zerubbabel and
Ezra's own later return, split at the same kind of real narrative seam that
splits 1-2 Samuel's Saul/David story into two `Journey` records — see below)
needed `places.json`/`regions.json` additions for its own background labels
and territory outline, but no `ERA_BOUNDS` override: unlike 1-2 Samuel's
tight Jerusalem-centered story, both journeys already span Babylon to
Jerusalem, wider than any override would add, so the default "fit to this
journey's own stops" behavior is already the right zoomed-out view.

**A journey can't span two separate book bundles, because nothing else in
this app can either.** `Journey.book` is one `BookIdSchema`, and a
`JourneyStop.eventId` is only ever looked up within that same book's
`events.json` (see the note on per-book lookups in `lib/content.ts`) — the
same invariant every other id in the app already relies on. This matters the
first time a single Bible narrative is split across two canonical books, as
1-2 Samuel's Saul/David story is (`1-samuel`/`2-samuel`, two separate
`BookContent` bundles — see the checklist below on why, mainly correct
citations: `formatCitation` resolves one static book name per book id, with
no per-chapter override, so a single merged "samuel" book couldn't display
"1 Samuel 17" vs. "2 Samuel 5" correctly). The fix is two `Journey` records,
one per book, that reuse the same character id naming and hex color for any
character present in both (David in 1-2 Samuel) — `1sam-journey` and
`2sam-journey` read as one continuous story split at the real narrative
seam (Saul's death) even though they're two separate pages. The same split
applies to `people.json`: a shared character needs its own `Person` entry
authored again in the second book (ids are never shared across books
either), even though it's "the same" David.

**The map is a real MapLibre GL vector render over bundled GeoJSON, not a
raster image — a rebuild that replaced an earlier cropped-SVG-map approach
once coordinate accuracy became a recurring source of back-and-forth.** The
original approach (see git history for the full story) baked marker
positions into a pre-labeled map image and read them off pixel-by-pixel;
every new stop or map fix meant another round trip to eyeball or
re-derive a pixel position. The current approach inverts that: `JourneyStop`
carries real, individually-researched latitude/longitude, and
`components/maps/JourneyMap.tsx` renders them with MapLibre GL JS against
three small bundled GeoJSON files in `components/maps/geo/` (land, rivers,
lakes — Natural Earth 1:50m data, clipped to the region and simplified,
public domain). There is no tile server, no API key, and no live third-party
request — the GeoJSON is the entire "map," shipped as a static asset like
everything else in this fully offline app. Pan/zoom are locked to the
journey's own bounds (`maxBounds` in `JourneyMap.tsx`) rather than left
free, since this is a fixed illustration of one story's geography, not a
general-purpose map to wander. The map is theme-aware — its water/land/
border/river colors are repainted via `setPaintProperty` on the site's
light/dark toggle, since a vector render (unlike a baked photo) can actually
do that. Modern political borders are deliberately absent — only coastlines,
rivers, and lakes are drawn, since the ancient Near East had none of today's
borders and drawing them would misrepresent the period.

**Turbopack does not bundle MapLibre's web worker correctly** (a confirmed
upstream bug, not a bug in this codebase) — without a workaround, MapLibre's
internal worker fails to resolve its own sibling module and no vector layer
ever renders. The fix is `public/maplibre/maplibre-gl-worker.mjs` and
`maplibre-gl-shared.mjs`, copied verbatim from `node_modules/maplibre-gl/
dist/` and pointed to explicitly via `setWorkerUrl()` before constructing
the map in `JourneyMap.tsx`. If `maplibre-gl` is ever upgraded, re-copy both
files from the new version's `dist/` — a version mismatch between the main
bundle and the worker files is a real failure mode.

**Coordinates are individually researched, not derived from the map.**
Every `JourneyStop.lat`/`lng` in `journeys.json` was looked up per place
(gazetteers and standard Bible-atlas identifications), not read off an
image or interpolated between neighbors. Where a site's identification is
genuinely disputed or only approximate (Nahor, Gerar, Peniel, Pharaoh's
court, Goshen), `locationNote` says so explicitly rather than presenting a
guess as settled fact — this is the field to add to when extending this
journey or authoring a new one, not something to leave silently ambiguous.

**The journey page fits one viewport on desktop, on purpose, and falls back
to a normal scrollable stack below a 720px breakpoint.** The two-column row
(`.journey-row` in `app/globals.css`) is a fixed `calc(100vh - 225px)`, not
`height: auto` — a story map is meant to be scanned back and forth between
the sidebar and the map, and having to scroll the page itself to see both
defeats that. The detail card lives in the left column, above the stop list,
not below the map spanning full width, so the currently-selected event's
description doesn't cost a screen's worth of scrolling to reach. MapLibre
needs a real pixel height for its canvas (unlike an `<img>`, it can't size
itself from intrinsic aspect-ratio), so `.journey-map-container` is `flex: 1`
on desktop and a fixed `height: 50vh` under the `@media (max-width: 720px)`
mobile fallback, where the two-column row also drops to a normal stacked,
scrollable layout. A `ResizeObserver` in `JourneyMap.tsx` calls `map.
resize()` whenever the container's actual size settles, since the map is
constructed before flexbox has necessarily finished laying out its final
size.

**A selected map dot always sits on top, regardless of stop order.** Each
stop's marker is a plain DOM element (MapLibre's `Marker` takes any HTML
element, not just a canvas draw call), so `JourneyMap.tsx` sets `el.style.
zIndex` directly — `10` for the selected stop, `1` otherwise — instead of
needing to control paint order the way the old SVG version did. `sorted`
(chronological order) is still what drives the sidebar list and Prev/Next;
only the marker's own z-index changes with selection. It also gets a white
halo (`box-shadow`, selected stops only), since size/z-index alone weren't
enough to make "this one's selected" obviously readable against a cluster of
same-color dots from that character's other stops.

**`JourneyStop.place` is authored independently of `Event.place`, on
purpose.** Most stops correspond to an event that already had `Event.place`
set (see the content authoring rule above), but a few intentionally add a
stop where `Event.place` was left unset — Abraham's call and his early trip
to Canaan and Egypt (Genesis 12), Joseph's last scene with the family before
Egypt (Genesis 37) — because a journey stop's location is a narrative fact
about the *walk*, not a quiz-distractor concern, and the two fields don't
need to agree. The patriarchs journey has 22 stops, still far short of one
per chapter across Genesis 12-50 — most events in that span still carry no
place at all, and a denser trail is a real future authoring task, not a gap
in the current one.

**One path per character, not one combined trail**, since the four
patriarchs' stories overlap in time rather than relay cleanly — Isaac's story
overlaps Abraham's, Jacob's overlaps Isaac's, and Joseph forks off into Egypt
while the rest of the family stays in Canaan until Genesis 46. A stop where
two characters' stories meet (Jacob and Joseph reuniting in Goshen) lists
both in `characterIds` and appears on both paths.

**Navigation is a single client-side page, not one page-load per stop.**
`JourneyExplorer` (a client component) holds the selected stop in React
state; the sidebar's character chips and stop list, the map's pins, and the
detail card all update without a route change. Clicking a character chip
both filters the map to their path and jumps straight to their first stop —
that's what makes reaching Joseph one click instead of walking the whole
family's chapters in order.

**Every stop is always visible, and only the selected one is highlighted —
this replaced an earlier design that hid everyone but the "active"
character's path.** That hiding made sense when the map also drew a route
line per character (a same-color line connecting the visible dots, so
"filtered to Jacob" read as an actual path); once the lines and direction
arrows were removed as visual noise (see below), hiding most of the dots
stopped being a feature and started being "why did most of the map
disappear." `JourneyMap.tsx` now fades every non-selected stop to `0.55`
opacity via `marker.setOpacity()` (not `el.style.opacity` directly — MapLibre's
`Marker` tracks its own `_opacity` and rewrites the DOM style on every map
move, silently clobbering a direct write the next time the map pans or
zooms) and leaves the selected one fully opaque with the white halo — enough
to make the current stop pop without hiding the rest of the story.
`effectiveCharacterId` in `JourneyExplorer` (`activeCharacterId`, an explicit
chip pin, falling back to the selected stop's own `characterIds[0]`) still
exists, but now only drives the character chips' pressed state and which
stops Prev/Next and the arrow keys step through (`navigable`) — it no longer
touches what's drawn on the map.

**There used to be per-character route lines and direction arrows between
stops; both were removed as visual noise once the background place labels
below existed to carry the "where is this, relative to what" context
instead.** A dense, heavily-overlapping story (three characters criss-
crossing the hill country in 1 Samuel) turned into a tangle of same-colored
lines that were harder to read than the plain dots, and the per-segment
direction arrows added detail without adding orientation. See git history
for the removed `arrowPoints()`/`JourneyMapLine` implementation if a future
journey turns out to need one of them back.

**Background place labels give general orientation (major cities, seas,
rivers, and neighboring peoples/regions) without cluttering the interactive
stops.** `components/maps/geo/places.json` is a small, hand-authored,
book-agnostic reference list — each entry a `{ id, name, lat, lng, kind:
"city" | "water" | "region", eras: string[] }` — separate from
`journeys.json`'s actual stops (which are researched per-event, not general
reference points; see below). `Journey.era` (`content/schema.ts`) is a
free-form string, not an enum, since new eras get added as new books do
rather than decided up front (`"patriarchs"` for Genesis, `"united-kingdom"`
for 1-2 Samuel so far). `JourneyMap.tsx`'s `placesGeoJSON()` shows a place
only when its own `eras` list includes the journey's era, so the same shared
list serves every journey without per-journey authoring — Jerusalem shows on
the Samuel maps but not on Genesis's, since it isn't in `"patriarchs"`.
Cities render as a small muted dot plus a left-anchored label; water
features (seas, rivers) render as italic text only, no dot, since they're
areas/lines rather than points; `"region"` (a people group's territory —
Philistia, Ammon, Moab...) renders as larger, letter-spaced italic text with
no dot either, since it labels an area, not a point. All three are plain
MapLibre symbol layers with no click handler — purely background context,
never competing with the interactive stop markers layered on top as DOM
elements.

**`ERA_BOUNDS` in `JourneyMap.tsx` overrides the default "fit to this
journey's own stops" zoom for an era whose real story happens in a tight
geographic cluster but whose readers need the wider regional context to
orient themselves.** 1-2 Samuel's Saul/David years mostly play out within a
day's walk of Jerusalem, so fitting the map to just those stops zoomed in
far enough to lose the surrounding kingdoms (Philistia, Ammon, Moab, Edom,
Aram) that the place and region labels exist to show. `"united-kingdom"`
gets a fixed bounds roughly matching a standard Bible-atlas "united kingdom"
map (Sidon/Damascus in the north to Kadesh-barnea in the south, the
Mediterranean to Ammon); an era with no entry here just falls back to fitting
the journey's own stops, which is already the right call for Genesis's
patriarchs (Haran to Egypt is already a wide span with nothing to gain from
overriding it).

**`components/maps/geo/regions.json` draws a rough territory outline for the
era's home kingdom — a translucent gold fill plus a dashed border, distinct
from the water-blue palette so it never reads as a sea.** This is explicitly
a simplification, not a scholarly reconstruction — the `note` field on each
entry says so, and the ring is a straight-segment approximation traced
through known anchor points (Dan, Carmel, Joppa, Beersheba, Kadesh-barnea,
the Dead Sea, the Arnon, Ramoth-Gilead, Edrei) rather than a real historical
border survey. It exists alongside the `"region"` point labels above, not
instead of them — the outline shows *where the line roughly falls*, the
point labels name *who's on the other side of it*, and together they read
closer to a standard Bible atlas than either would alone. One polygon per
era, keyed the same way as everything else in this file (`era` must match a
`Journey.era` string); an era with no entry here just renders no outline, the
same graceful fallback as `ERA_BOUNDS` and the place labels above.

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
- **Multi-book UI wiring**: Genesis, Exodus, Psalms, John, 1 Samuel, 2 Samuel,
  and misc (displayed as "Miscellaneous") each have a full section (`app/[book]/*` —
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
  new book needs a card added there too. Both `wiredBookIds` and `available`
  are kept in canonical Bible order (Genesis, Exodus, ..., 1/2 Samuel, ...,
  Psalms, ..., John, ..., with `misc` last since it has no real position);
  insert a new book at its canonical spot in both places, not at the end.
  `available` entries also carry a `featured` flag: the home page shows only
  the featured ones (currently 6, everything but Exodus), and `/modules`
  (`app/modules/page.tsx`) lists the full set. A new book defaults to
  `featured: true` unless there's a reason to hide it from the home page.
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
8. For a non-`"selection"` book, author `Chapter.blurb`: one real sentence
   per chapter, longer than `title` but noticeably shorter than `summary`,
   same plot-level voice, so the Chapter Order board (see above) has a
   compact card. Optional in the schema, but `check:content` warns on any
   quizzable chapter missing one, so treat that warning as this step.
9. `npm test`, `npx tsc --noEmit`, `npx eslint .`, `rm -rf .next && npm run
   build` — all four, not just `check:content`.
