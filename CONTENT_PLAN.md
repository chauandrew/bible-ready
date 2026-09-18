# Content plan: the whole Bible

The working plan for taking `content/` from 10 modules to all 66 books, plus
the general-knowledge layer on top. `DESIGN.md` says *why* things are shaped
the way they are; this file says *what's next, what's decided, and how each
book gets authored the same way every time*. It lives in the repo so a session
with no memory of the last one can pick up where it left off.

## How to use this file (start of every content session)

1. Read this file, then `DESIGN.md`. Both are binding.
2. Pick the next `todo` or `partial` row in the coverage table, in roadmap
   order (below). One book per PR.
3. Run the pre-flight questions for that book (see the session recipe) and
   wait for answers. Only then author.
4. Follow the session recipe end to end. Update this file's coverage table,
   retro tasks, and log **in the same PR** as the content.
5. Never merge; the human merges.

## Decisions (settled 2026-09-15)

Scope
- Protestant 66-book canon. Every book gets its own module, one per book
  (1 Kings and 2 Kings are separate, each minor prophet is separate, the five
  one-chapter books are separate). No multi-book modules.
- "Cover the entire Bible" means every book has a module. Narrative books and
  epistles cover every chapter; long prophets and Proverbs start as a
  `selection` of famous chapters and can be upgraded later.
- Order: finish the remaining narrative books first (the model is proven),
  then one pilot book per unfamiliar genre, then batch that genre.
  Exodus 15-40 is the first content PR (it is the only half-authored book).
- Psalms stays at 19 curated chapters for now.

Depth
- Narrative books get the 1 Samuel treatment: 2-3 events per chapter,
  roughly one authored question per chapter, `quizWorthy` on about two thirds
  of chapters, one flashcard deck per arc, a blurb on every chapter.
- `sparse` (law, short prophets, Ecclesiastes, Song of Solomon, Lamentations,
  Chronicles): one event per chapter (the chapter's main law, oracle, or
  instruction), no `place`, `quizWorthy` only on narrative chapters, arcs by
  section, authored questions on the major institutions and images, no
  sequence questions (arcs will rarely clear the 4-event floor anyway).
- `argument` (epistles): the Galatians model, one event per chapter.
- `selection` (Proverbs, Isaiah, Jeremiah, Ezekiel): the Psalms model, one
  event per chapter, `place` repurposed as occasion only where distinctive.
- Job: dense narrative frame (1-2, 42), one event per speech chapter with the
  speaker as the fact being tested.
- Daniel and Revelation: `narrative`, visions as events in text order.
- 1-2 Chronicles: `sparse`, authored last.
- Mark and Luke: authored questions emphasize material unique to that Gospel.
  A "which Gospel" list module is wanted later (see open questions).

Quotes (ESV)
- Corpus cap is 1,000 verses (`VERSE_BUDGET_TOTAL`), 25% per book. Budget
  about 15 per narrative book, 5-10 per epistle or prophet, 0 for law,
  genealogy, and Chronicles. Zero quotes is fine: the book just gets no
  "who says this" questions.
- "Who says this" is for **people only**, Jesus included. No quotes spoken by
  God or the LORD (`check:content` warns on any). Prophetic oracles quote the
  prophet only where the prophet speaks in his own voice. Retro task below
  removes the existing God/LORD quotes.
- `VERSE_COUNTS` is pre-filled for all 66 books; no per-book step.

People and places (out of scope for this plan)
- `people.json` is authored only as far as events and quotes need it: name,
  a short summary, `firstAppearance`, relations optional. Shared characters
  are re-authored per book (the 1-2 Samuel precedent). Ids are
  `<abbr>-<name>` (`1kg-elijah`), never bare (`elijah`). Reviewing or
  deepening people content is a separate effort.
- `Event.place` is not a target. Set it only when it's obvious and the arc
  will clearly have 4+ distinct places; otherwise leave it unset. Location and
  match questions are a bonus, not a requirement.

Authored questions
- Reuse the five categories (`theme`, `arc`, `covenant`, `character`,
  `argument`); no new ones.
- Prompts ask what happens, not what it means (`check:content` warns on the
  "what does X show/reveal/teach" pattern).
- Prompts name the book, since the whole-Bible quiz mixes books: "In Exodus,
  what role do Shiphrah and Puah play?", "In Paul's allegory in Galatians,
  whom does Hagar represent?". Never the chapter number, except in a
  `selection` book where the chapter is the unit's name ("What is Psalm 119
  about?"); `check:content`'s chapter-leak rule exempts `selection` books for
  exactly this.
- Plain and straightforward. No trick questions, no synthesis across
  passages ("what do these two women have in common"), no "traditionally
  credited with" trivia. Breadth comes from asking many plain questions
  across the whole book, not from making each one clever.
- Two formats, mixed automatically, no toggle: short answer (`format:
  "short-answer"`, a 1-2 word `answer` plus `aliases`) for names, places,
  numbers, titles; multiple choice for anything whose answer is a clause.
  Roughly a third of a book's authored questions short answer. A prompt that
  only works against options ("which of these is not...") is never short
  answer; `check:content` errors on both misuses. Exemplars: `matt-aq-21`,
  `matt-aq-42`.
- "In what book and chapter does David kill Goliath?" already exists as the
  generated chapter-guess item for every notable event; General mode
  surfaces the famous ones once events are tagged.
- Distractors follow DESIGN.md's "Distractors must be believable" rules:
  same kind and shape, in-world, built from real confusions, false as
  stated, no absurd or absolute options. The Galatians set gets rewritten
  (retro task).
- Explanation on every question: one sentence or a brief phrase.
- Authorship only as the text itself claims (no "Paul wrote Hebrews"), no
  dating, no interpretive stances on Revelation or Daniel. Ask what the text
  says.
- The `general` tier is broad: any plain plot-level fact, even about a minor
  character. `deep` is the minority (incidental detail, ritual mechanics,
  synthesis, trivia). See the rubric and the labeled calibration set.

Process
- Automated gates plus a rubric self-review plus adversarial review agents,
  then a 10-item sample in the PR description for spot-checking. The human
  does not read whole books.
- Reference for structure: The Bible Project's book overviews (video and
  poster divisions). Arcs should follow those divisions, snapped to chapter
  boundaries. Never copy their prose; every summary here is original.

## Open questions (ask before the book that needs the answer)

- Psalms: is "The Psalmist" (anonymous psalms) an acceptable speaker under the
  people-only rule? Recommended: yes, it names a human author.
- Proverbs, Isaiah, Jeremiah, Ezekiel: confirm the selection chapter list in
  that book's pre-flight before authoring.
- "Which Gospel", kings of Israel and Judah, judges, plagues, Ten
  Commandments, Beatitudes, Paul's journeys: new sections in `misc` or new
  list modules? Decide at the first one.
- Book id for the Song: `song-of-solomon` (ESV title) is assumed.
- Any other reference resources beyond The Bible Project?
- (resolved 2026-09-16) The retro pass converted eligible existing questions
  to short answer alongside the book-name rewrite.

## Conventions by genre

Everything in `DESIGN.md` applies. What differs per genre:

| Genre | `coverageDepth` | Events/chapter | `quizWorthy` | Quotes | Sequence | Chapter Order |
|---|---|---|---|---|---|---|
| Narrative | `narrative` | 2-3 | ~2/3 of chapters | ~15 | yes | yes |
| Epistle | `argument` | 1 (main move) | most chapters | 5-10 | rarely (arcs too short) | yes |
| Law, short prophet, Chronicles, short wisdom | `sparse` | 1 | narrative chapters only | 0-5 | no | yes |
| Long prophet, Proverbs, Psalms | `selection` | 1 | none | 5-10 | no | no (route not built) |
| Job | `narrative` | frame 2-3, speeches 1 | frame chapters | ~10, one per speaker | frame arc only | yes |

Short and one-chapter books (Ruth 4, Jonah 4, Haggai 2, Obadiah 1, Philemon
1, 2 John 1, 3 John 1, Jude 1):
- `chapterCount` under 3 must be excluded from Chapter Order (code follow-up
  below, before the first such book lands).
- A one-chapter book's "which chapter" question is trivial in a single-book
  quiz and fine in the whole-Bible quiz; guard the single-book case in
  `generateChapterQuestions` when the first one lands (code follow-up).
- Chapter-summary questions need 3 other chapter titles in the book, so books
  under 4 chapters generate none. That is correct, not a gap.
- One arc, 4+ events, so a sequence question still exists.

Prophets whose chapters are not chronological (Isaiah, Jeremiah, Ezekiel,
Hosea, Amos, Zechariah): arcs are thematic or by oracle collection, and only a
genuinely narrative arc (Isaiah 36-39, Jeremiah's arrest and Egypt chapters)
may be contiguous enough to yield a sequence question. Never make a sequence
question out of oracle order.

Parallel books (Mark, Luke, 1-2 Chronicles): `check:content` warns on
cross-book near-duplicate answers. Prefer the material unique to the book;
when a shared event is unavoidable, ask about the detail only that book has.

## Per-module session recipe

Pre-flight (one message to the human, wait for the answer; "defaults" is a
valid answer):
1. Proposed `coverageDepth`, arcs with chapter ranges, and the Bible Project
   division they follow.
2. For a `selection` book: the proposed chapter list.
3. Proposed quote count and the speakers they'd come from.
4. Anything about this book that doesn't fit the conventions above.
5. Any other judgment call you'd rather not make alone.

Author (in this order, `npm run check:content` after each file):
1. `book.json` (id, name, `citationName` if the singular differs,
   `coverageDepth`, `arcOrder`; `defaultTier: "general"` only for a book
   whose every fact is famous, like Jonah or Ruth).
2. `arcs.json`.
3. `chapters.json`: title, 15-45 word summary, blurb (non-selection), arcId,
   eventIds, `quizWorthy`, aliases only where a nickname isn't in the text.
4. `events.json`: `tier` on every event that is famous (`"general"`), the
   rest left unset. `shortName` on events that will be on a flashcard.
5. `people.json`: only what events and quotes reference.
6. `quotes.json`: people only, single verses, no two adjacent verses in a
   chapter, spoken words only, `tier` where famous.
7. `questions.json`: about one per chapter, `tier` where famous, roughly a
   third short answer (see the format rules above), distractors per
   DESIGN.md's believability rules.
8. `decks.json`: one per arc.
9. `journeys.json` is out of scope (tracked as follow-ups).

Wire (code):
- `lib/content.ts`: imports, `BookContentSchema.parse`, `booksContent`
  entry, `wiredBookIds` in canonical order.
- `app/page.tsx` `available`: card in canonical order, `featured: true`
  unless there's a reason not to.
- `DESIGN.md`/`README.md` only if a convention changed.

Verify:
1. `npm run check:content`: zero errors, and zero *new* warnings for this
   book. Warnings about the book must be fixed, not accepted.
2. Self-review against the rubric below, reading the actual ESV chapter for
   every event and every authored question's correct answer.
3. Adversarial review: one review agent per chapter (per arc for a book over
   ~25 chapters), each reading via `git show <branch>:<path>`, checking every
   fact against the text and every distractor for accidental truth; one more
   agent on the code-wiring diff. Fix everything they find.
4. `npm test`, `npx tsc --noEmit`, `npx eslint lib components scripts content
   app` (the root run also lints `public/maplibre`'s vendored worker),
   `rm -rf .next && npm run build`.
5. Open the book's home, one arc page, one chapter page, the quiz setup, and
   Chapter Order in the browser.

PR description template:
```
## <Book>: <depth>, <n> chapters
Arcs: ...
Counts: events N, quotes N (corpus total now N/1000), questions N, decks N
Tier: N general of M events, N of M questions

## Spot-check sample
5 authored questions (prompt, correct answer)
3 events (name, summary)
2 chapter summaries

## Review
check:content: 0 errors, 0 new warnings
Adversarial review: N findings fixed (list the non-trivial ones)

## Plan file
Coverage table row updated; retro tasks / log updated.
```

If a book can't finish in one session: commit what exists to the branch, set
the table row to `partial: chapters 1-N`, and note in the log what's left.

## Quality rubric (self-review, every book)

- Every event name is a clean noun phrase, names no chapter, names no place
  it would be asked about.
- Every chapter summary is 15-45 words and would not identify itself by
  length next to its neighbors.
- Every prompt asks what happens. Every correct answer was checked against
  the ESV chapter, not memory.
- Distractors: same kind, shape, and length band as the correct answer;
  in-world; built from real confusions (other character, neighboring chapter,
  reversed roles, popular misconception); never accidentally or partially
  true. No "all/none of the above", no absurd options, no two options that
  are both defensible. Cover the answer: would a half-remembering reader pick
  each wrong option?
- Short answers: 1-2 significant words, prompt stands alone without options,
  aliases only for real alternates (numerals, alternate names).
- ESV spellings and names; "the LORD" as written.
- Tier, calibrated on the labeled set below (Andrew, 2026-09-16): `general`
  is any plain plot-level fact, including what a named minor character does
  or says (Ittai's loyalty, Shecaniah's proposal, Caiaphas's argument all
  labeled general). `deep` is incidental detail (how loudly Joseph wept,
  where Terah settled), ritual mechanics and their meaning (the fire pot and
  torch), synthesis across passages (the two wise women, a group of psalms'
  shared theme), and authorship trivia. So the general share of a narrative
  book is high, most of its authored questions; deep is the minority. Tag
  events the same way: the event is general if a plain "what happens" question
  about it would be.
- Explanations confirm, they don't lecture.

## Roadmap

Phase 0 (this PR): this file; `tier` on events/quotes/questions plus
`Book.defaultTier`; General knowledge mode on `/quiz/bible`; verse cap to
1,000 and `VERSE_COUNTS` for all 66; new `check:content` warnings (God/LORD
speakers, meaning-style prompts, authored-question floor, cross-book
near-duplicates); `misc` tagged `defaultTier: "general"`.

Phase 1, narrative books, in this order: Exodus 15-40, Joshua, Judges, Ruth,
1 Kings, 2 Kings, Mark, Luke, Acts, Daniel, Jonah, Esther, Nehemiah, Numbers,
Revelation.

Phase 2, one pilot per genre, and after each pilot fold what was learned into
`DESIGN.md` before batching: Romans (argument at scale), Leviticus (sparse),
Proverbs (selection outside Psalms), Job (speech book), Isaiah (long prophet
as selection), Hosea (short prophet), Philemon (one chapter).

Phase 3, batches: remaining epistles; remaining prophets; Ecclesiastes, Song
of Solomon, Lamentations; Deuteronomy; 1-2 Chronicles last.

Phase 4, backfill and lists: `tier` tags on the nine original books; the
retro tasks below; list modules (kings, judges, plagues, Ten Commandments,
Beatitudes, Paul's journeys, "which Gospel"); Psalms expansion if wanted.

Code follow-ups, each with its trigger:
- Exclude `chapterCount < 3` from Chapter Order and the book's review-tools
  list: before Haggai or any one-chapter book.
- Skip `generateChapterQuestions` for a one-chapter book in a single-book
  quiz: before Philemon.
- `matchBookName` aliases ("Song of Songs", "Revelations", "1st Samuel"):
  when the whole-Bible chapter guess starts spanning many books.
- Homepage grouping by testament and genre, `available` derived from content:
  at about 15 books.
- Per-book code splitting (all content JSON currently ships in the client
  bundle, ~700 KB for 9 books): at about 20 books.
- `/progress` line for Chapter Order: unchanged, still deferred (see
  `DESIGN.md`).

## Retro tasks (existing content)

- [x] Remove the 20 God/LORD-spoken quotes (Genesis 10, Exodus 5, Matthew
      2, 1 Samuel 2, 2 Samuel 1) and the one person entry nothing else
      referenced (`1sam-god`). Corpus now quotes 115 of the 1,000-verse
      cap; the gate is an error from here on (2026-09-16).
- [x] Rewrite Galatians' authored distractors to full-sentence style
      (2026-09-16, with the short-answer pass).
- [x] Exodus: `quizWorthy` backfilled on chapters 1-14 (12 of 14; 6 and 11
      skipped — 6 has an embedded genealogy and repeats the ch3-4 covenant
      revelation, 11 is a short transitional recap), chapters 15-40 authored,
      and the original 22 questions rewritten off arc/theme synthesis onto
      plain plot-level facts (2026-09-16).
- [x] Meaning-style prompts and the cross-book duplicate (2026-09-16).
- [ ] Tag `tier` across the nine original books using the calibrated
      rubric (most authored questions will be general).
- [x] Book name in every existing authored prompt; eligible questions
      converted to short answer (92 of 278, 2026-09-16); John's synthesis
      questions replaced with plain ones; Psalms prompts name the psalm.
- [ ] Explanations on Genesis, 2 Samuel, and John's remaining
      multiple-choice questions (their short answers have them; the rest
      never did).
- [ ] Matthew still has a few weak distractor sets (matt-aq-14, -15, -16,
      -19, -25, -32, -40, -45); rewrite when Mark/Luke are authored, since
      the parallel-Gospel confusions become available then.

## Calibration set (label each G = general, D = deep/too specific)

Existing authored questions, chosen to span the range. Labeled by Andrew on
2026-09-16 ("fine" = general); the rubric's tier guidance above is derived
from these labels.

| # | Id | Prompt | Answer | Label |
|---|---|---|---|---|
| 1 | qz-47 | Why does Cain kill his brother Abel? | God favored Abel's offering, not his | G |
| 2 | qz-15 | What happens to Lot's wife as the family flees Sodom? | Looks back, becomes a pillar of salt | G |
| 3 | qz-59 | Where does Abram's father Terah settle the family on the way from Ur to Canaan? | Haran | D |
| 4 | qz-44 | How loudly does Joseph weep when he reveals himself to his brothers? | So loudly the Egyptians and Pharaoh's household hear | D |
| 5 | qz-26 | What ritual accompanies God's covenant-making with Abram, and what does it signify? | Fire pot and torch pass between the pieces; God alone takes on the obligation | D (fine as MC) |
| 6 | exo-q-arc-1 | What is the overall shift in Israel's circumstances across this part of the story? | Oppressed slaves to a free people | G, reword |
| 7 | exo-q-character-3 | What role do Shiphrah and Puah play early in the story? | Midwives who refuse to kill Hebrew boys | G |
| 8 | 1sam-aq-character-5 | What reasons does David give Saul for why he can defeat Goliath? | He killed a lion and a bear; the LORD will save him | G |
| 9 | 1sam-aq-theme-10 | What does the text say about how often the LORD was speaking to Israel right before he calls Samuel? | The word of the LORD was rare | G |
| 10 | 1sam-aq-character-11 | What does Abigail do when she learns Nabal has insulted David's messengers? | Brings food and gifts to David before he takes revenge | G |
| 11 | 2sam-aq-covenant-2 | What does God promise David through Nathan instead of letting David build him a house? | An everlasting dynasty | G |
| 12 | 2sam-aq-character-8 | What does Ittai say when David tells him he is free to stay behind? | Wherever the king goes, he goes | G |
| 13 | 2sam-aq-theme-7 | What do the wise woman of Tekoa and the wise woman of Abel Beth-maacah have in common? | Ordinary women whose words change a conflict involving the king | D, split |
| 14 | ezra-aq-1 | What does Cyrus's decree permit the Jewish exiles to do? | Return to Jerusalem and rebuild the temple | G |
| 15 | ezra-aq-17 | What does Shecaniah propose to Ezra and the assembly? | A covenant to put away the foreign wives | G |
| 16 | gal-aq-15 | Which of these is not a fruit of the Spirit? | Enmity | G |
| 17 | gal-aq-10 | In Paul's allegory, whom does Hagar represent? | The covenant from Sinai, bearing children for slavery | G |
| 18 | matt-aq-42 | How many times does Peter deny knowing Jesus before the rooster crows? | Three | G |
| 19 | matt-aq-33 | In the parable of the workers in the vineyard, what surprises the workers hired first? | Same wage as those hired last | G |
| 20 | matt-aq-21 | What title does Jesus claim after healing a withered hand on the Sabbath? | Lord of the Sabbath | G |
| 21 | jn-q-theme-1 | What common thread connects the seven signs Jesus performs in this Gospel? | Each reveals Jesus' identity and points toward belief | G |
| 22 | jn-q-character-5 | What does Caiaphas argue when the council debates what to do about Jesus after Lazarus is raised? | Better one man die than the nation perish | G |
| 23 | psalms-q1 | Which king is traditionally credited with "The LORD is my shepherd"? | David | replace |
| 24 | psalms-q16 | The two-ways psalm, the humanity psalm, the heavens psalm, the King-of-glory psalm, and the numbering-our-days psalm are grouped around what? | Wisdom, creation, and God's presence | D |
| 25 | psalms-q25 | The longest chapter in the Bible spends its 176 verses meditating on what? | God's law | G, reword |

## Coverage table

Status: `done` (module shipped, every planned chapter), `partial`, `todo`.
Depth is the planned `coverageDepth`. Ch is the real chapter count.

| Book | Id | Ch | Depth | Status | Notes |
|---|---|---|---|---|---|
| Genesis | genesis | 50 | narrative | done | tier backfill pending |
| Exodus | exodus | 40 | narrative | done | tier backfill pending (ch 1-14); 25-31/35-39 mostly 1 event/chapter (law/construction; 31 and 39 have 2) |
| Leviticus | leviticus | 27 | sparse | todo | Phase 2 pilot for sparse |
| Numbers | numbers | 36 | narrative | todo | law/census chapters get one event |
| Deuteronomy | deuteronomy | 34 | sparse | todo | |
| Joshua | joshua | 24 | narrative | done | journey follow-up (conquest) |
| Judges | judges | 21 | narrative | done | |
| Ruth | ruth | 4 | narrative | todo | candidate `defaultTier: general` |
| 1 Samuel | 1-samuel | 31 | narrative | done | tier backfill pending |
| 2 Samuel | 2-samuel | 24 | narrative | done | tier backfill pending |
| 1 Kings | 1-kings | 22 | narrative | done | |
| 2 Kings | 2-kings | 25 | narrative | todo | |
| 1 Chronicles | 1-chronicles | 29 | sparse | todo | last; genealogies 1-9 |
| 2 Chronicles | 2-chronicles | 36 | sparse | todo | last; parallels Kings |
| Ezra | ezra | 10 | narrative | done | tier backfill pending |
| Nehemiah | nehemiah | 13 | narrative | todo | |
| Esther | esther | 10 | narrative | todo | |
| Job | job | 42 | narrative | todo | Phase 2 pilot for speech books |
| Psalms | psalms | 150 | selection | partial (19) | expansion undecided |
| Proverbs | proverbs | 31 | selection | todo | Phase 2 pilot; confirm chapter list |
| Ecclesiastes | ecclesiastes | 12 | sparse | todo | |
| Song of Solomon | song-of-solomon | 8 | sparse | todo | |
| Isaiah | isaiah | 66 | selection | todo | Phase 2 pilot; confirm chapter list; 36-39 narrative |
| Jeremiah | jeremiah | 52 | selection | todo | chapters not chronological |
| Lamentations | lamentations | 5 | sparse | todo | |
| Ezekiel | ezekiel | 48 | selection | todo | |
| Daniel | daniel | 12 | narrative | todo | |
| Hosea | hosea | 14 | sparse | todo | Phase 2 pilot for short prophets |
| Joel | joel | 3 | sparse | todo | |
| Amos | amos | 9 | sparse | todo | |
| Obadiah | obadiah | 1 | sparse | todo | one chapter; code follow-ups first |
| Jonah | jonah | 4 | narrative | todo | candidate `defaultTier: general` |
| Micah | micah | 7 | sparse | todo | |
| Nahum | nahum | 3 | sparse | todo | |
| Habakkuk | habakkuk | 3 | sparse | todo | |
| Zephaniah | zephaniah | 3 | sparse | todo | |
| Haggai | haggai | 2 | sparse | todo | Chapter Order exclusion first |
| Zechariah | zechariah | 14 | sparse | todo | |
| Malachi | malachi | 4 | sparse | todo | |
| Matthew | matthew | 28 | narrative | done | tier backfill pending |
| Mark | mark | 16 | narrative | todo | unique material first |
| Luke | luke | 24 | narrative | todo | unique material first |
| John | john | 21 | narrative | done | tier backfill pending |
| Acts | acts | 28 | narrative | todo | journey follow-up (Paul) |
| Romans | romans | 16 | argument | todo | Phase 2 pilot for argument at scale |
| 1 Corinthians | 1-corinthians | 16 | argument | todo | |
| 2 Corinthians | 2-corinthians | 13 | argument | todo | |
| Galatians | galatians | 6 | argument | done | distractor rewrite pending |
| Ephesians | ephesians | 6 | argument | todo | |
| Philippians | philippians | 4 | argument | todo | |
| Colossians | colossians | 4 | argument | todo | |
| 1 Thessalonians | 1-thessalonians | 5 | argument | todo | |
| 2 Thessalonians | 2-thessalonians | 3 | argument | todo | |
| 1 Timothy | 1-timothy | 6 | argument | todo | |
| 2 Timothy | 2-timothy | 4 | argument | todo | |
| Titus | titus | 3 | argument | todo | |
| Philemon | philemon | 1 | argument | todo | Phase 2 pilot for one chapter |
| Hebrews | hebrews | 13 | argument | todo | |
| James | james | 5 | argument | todo | |
| 1 Peter | 1-peter | 5 | argument | todo | |
| 2 Peter | 2-peter | 3 | argument | todo | |
| 1 John | 1-john | 5 | argument | todo | |
| 2 John | 2-john | 1 | argument | todo | one chapter |
| 3 John | 3-john | 1 | argument | todo | one chapter |
| Jude | jude | 1 | argument | todo | one chapter |
| Revelation | revelation | 22 | narrative | todo | visions as events |
| Miscellaneous | misc | 4 sections | selection | done | `defaultTier: general`; more lists in Phase 4 |

Totals: 12 of 66 books have a module (1 partial); 296 of 1,189 chapters.

## Log

- 2026-09-15: Phase 0. Decisions above settled with Andrew. Tier field,
  General mode, verse cap 1,000, new gates, this file.
- 2026-09-16: Calibration set labeled. Tier rubric rewritten (general is the
  majority; deep is incidental detail, ritual mechanics, synthesis, trivia).
  New prompt conventions: name the book, keep it plain. `check:content`'s
  chapter-leak rule now exempts `selection` books. Retro tasks added for
  existing prompts. Short-answer authored format added (no toggle; formats
  mix automatically), with `matt-aq-21`/`matt-aq-42` converted as exemplars.
  Distractor believability rules written into DESIGN.md. Then the retro
  pass over all 278 existing questions: every prompt names its book, 92
  converted to short answer, John and Galatians rewritten, Psalms prompts
  name the psalm, the four calibration rewrites done. One review agent per
  book (or pair) checked every answer, alias, distractor, and explanation
  against the ESV afterward. The 20 God/LORD quotes were removed and that
  gate became an error.
- 2026-09-16: Exodus 15-40 authored (Phase 1's first item), closing out the
  book: 5 new arcs (To Sinai, The Covenant at Sinai, Tabernacle Instructions,
  The Golden Calf, Building the Tabernacle), 26 chapters, events at full
  narrative density except the tabernacle instruction/construction chapters
  (25-31, 35-39), which get 1 event/chapter since they're law/repetitive-
  construction content rather than narrated action. `quizWorthy` backfilled
  on chapters 1-14 (12 of 14). Quotes went from 4 to 15 (people only —
  Miriam, Moses, Aaron, Jethro; corpus total now 126/1,000). The original 22
  authored questions were rewritten off whole-book synthesis ("how does
  Moses change," "how do Israel's circumstances change") onto single
  concrete-moment facts, plus 21 new questions for chapters 15-40 (43 total,
  16 short answer). Three adversarial review agents (one per new arc-pair)
  found and fixed: two place-in-name leaks past regex evasion (`Elim's`,
  a shortName), one inconsistent `peopleIds` tag, one summary overclaiming
  Exodus 40 narrates Aaron's ordination (that's Leviticus 8), and two weak
  distractors. `app/page.tsx`'s Exodus card now says 40 chapters and is
  featured. Tier backfill on chapters 1-14 stays deferred to the Phase 4
  blanket pass with Genesis/1-2 Samuel/Ezra/Matthew/John, per Andrew.
- 2026-09-17: Joshua authored (Phase 1's second item), the book's first
  module: 6 arcs (Entering the Land, Jericho and Ai, Conquering the Land,
  Dividing the Land, Refuge and Levite Cities, Covenant Renewal), 24
  chapters, 48 events at full narrative density (2-3/chapter) except the
  land-division chapters (13-21), which get 1 event/chapter since they're
  territorial lists rather than narrated action (15 and 18 get 2, for the
  Othniel/Achsah story and Benjamin's allotment). `quizWorthy` on 16 of 24
  chapters. 12 quotes, people only (Joshua, Rahab, Achan, Caleb, and
  several collective speakers — the people of Israel, the Gibeonites,
  Zelophehad's daughters, the Transjordan tribes — following 1 Samuel's
  "The Elders of Israel" precedent); corpus total now 138/1,000. 19
  authored questions (8 short answer). `check:content` passed with zero
  new warnings after removing 13 `Event.place` tags that leaked into their
  own event's `name` (Jericho, the Jordan, Gilgal, Gibeon, Makkedah, Hazor,
  Hebron, Shiloh, Timnath-serah, Mount Ebal, the waters of Merom) and
  lengthening 3 distractors to clear the answer-length-tell gate (7/11 MC
  questions had started with the correct option as the single longest).
  journeys.json out of scope per this plan's decisions. Two adversarial
  review agents (one content, one code-wiring) found and fixed: a wrong
  king count in ch12 (the text's "thirty-one" is Joshua's own west-of-
  Jordan tally, not a combined total with Moses's 2 — the real combined
  total is 33), a speaker misattribution (ch1:16's pledge belongs to the
  Transjordan tribes addressed in the preceding verses, not Israel
  generally), a chapter-18 gap (Benjamin's allotment, over half the
  chapter, had no event at all), two more place/name leaks the automated
  check's 4-character-minimum heuristic missed ("Ai"), and one missing
  `peopleIds` tag. The code-wiring review found no issues.
- 2026-09-17: Judges authored (Phase 1's third item), the book's first
  module: 7 arcs following the judge-by-judge structure (Incomplete
  Conquest and the Broken Cycle, Deborah and Barak, Gideon, Abimelech's
  Kingship, Jephthah and the Minor Judges, Samson, Israel's Moral
  Collapse), 21 chapters, 67 events at full narrative density (the book
  has little list-heavy content compared to Joshua, so most chapters get
  3-4 events). 14 of 21 chapters `quizWorthy` (2/3, per convention).
  14 quotes, people only (Adoni-bezek, Ehud, Deborah, Gideon x2, Gideon's
  Three Hundred as a collective speaker, Jotham, Jephthah, Jephthah's
  daughter, Manoah's wife, Samson x3, Micah; corpus total now 152/1,000)
  — the angel of the LORD's speeches (2:1-3, 6:11-24, 13:3-23) were
  excluded from the quote corpus as a LORD-adjacent speaker, per the
  pre-flight judgment call. Chapter 19's content (the Levite's concubine)
  is stated factually and matter-of-factly with no graphic language, per
  the pre-flight plan. 21 authored questions (7 short answer, one per
  chapter). Fixed pre-push: one length-tell violation (8/14 MC questions
  had the correct option as the single longest; lengthened one
  distractor) and one generated-ambiguity warning (a "who says this"
  quote whose collective speaker name, "The People of Israel," shared
  the word "Israel" with its own quoted text; the quote was dropped
  rather than kept for a trivial question). Two adversarial review
  agents (one content, one code-wiring) found and fixed: chapter 20's
  troop count conflated Benjamin's 700 Gibeah slingers with its 26,000
  swordsmen instead of adding them per the text's "besides" (20:15-16),
  three MC distractors invented lore the text never states (a
  Barak/Shamgar sibling relation, a magic ring, Babylon exile) instead
  of exploiting real in-book confusions, an arc summary had a
  pronoun-verb typo, Samson's birth was left untagged despite being
  general-knowledge famous, and the log's own quote-speaker tally was
  off by one for both Gideon and Samson. The code-wiring review found no
  other issues.
- 2026-09-17: 1 Kings authored (Phase 1's fifth item, on a branch cut
  before Ruth merged — 1 Kings is wired into its correct canonical slot,
  after 1-2 Samuel and before Ezra, but the coverage table/totals below
  reflect this branch's own base and will need reconciling with Ruth's
  numbers at merge time), the book's first module: 8 arcs (Solomon
  Succeeds David, Solomon's Wisdom and Kingdom, Building the Temple,
  Solomon's Wealth and Downfall, The Kingdom Divides, Kings of Israel
  and Judah, Elijah Confronts Ahab, Ahab's Wars and Naboth's Vineyard),
  22 chapters, 55 events at full narrative density except the
  temple-construction/administrative chapters (4-7, 9), which get 1-2
  events/chapter. 16 of 22 chapters `quizWorthy`. 15 quotes, people
  only (Adonijah, David, Solomon, the boy's true mother, the queen of
  Sheba, Rehoboam, Jeroboam, Elijah x3, the people of Israel, Naboth,
  Ahab, Micaiah; corpus total now 167/1,000, budget shared independently
  of Ruth's branch). 20 authored questions (7 short answer, roughly one
  per chapter). Two Hirams needed disambiguating throughout (Hiram king
  of Tyre, who supplies timber, vs. Hiram the bronze craftsman, who
  casts the temple's furnishings) — separate `Person` entries, checked
  at every citing event. `check:content` passed with zero new warnings
  after two candidate quotes ("call me Mara"-style self-naming) were
  swapped or trimmed before they became warnings. Two adversarial
  review agents (one content, one code-wiring) found and fixed: 1 Kings
  had been wired into the wrong canonical slot (between Judges and 1
  Samuel instead of after 2 Samuel — this book has no `defaultTier`
  like Ruth's, so getting the slot right actually mattered for nothing
  else), all 20 authored questions plus 2 quotes and 1 event were
  missing `tier: "general"` despite reading as plain plot-level facts,
  the temple arc's summary conflated the two Hirams into one person,
  one question's "brother" prompt had Ahab and Ben-hadad's roles
  reversed, and one question's distractor ("Samaria as a consolation")
  was anachronistic since Samaria isn't founded until five chapters
  later.
