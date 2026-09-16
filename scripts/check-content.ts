#!/usr/bin/env -S npx tsx
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BookContentSchema } from "../content/schema";
import { findAmbiguities } from "../lib/generate";
import { deriveGradingTerms } from "../lib/grade";

/**
 * The one build gate for content. Fails loudly on anything that would ship a
 * broken reference, a leaked answer, or an ESV license overage. Run with:
 *   npm run check:content
 */

const CONTENT_ROOT = join(__dirname, "..", "content");
const errors: string[] = [];
/** Printed but non-fatal: content the generator already refuses to build a
 * question from, so nothing broken ships — it just isn't pulling its weight. */
const warnings: string[] = [];

// Verse counts per book (standard KJV/ESV versification; the ESV differs by a
// verse or two in a handful of books, which the 25% budget below absorbs).
// Filled out for all 66 so a new book's percentage check can never silently
// no-op — see CONTENT_PLAN.md.
const VERSE_COUNTS: Record<string, number> = {
  genesis: 1533, exodus: 1213, leviticus: 859, numbers: 1288, deuteronomy: 959,
  joshua: 658, judges: 618, ruth: 85, "1-samuel": 810, "2-samuel": 695,
  "1-kings": 816, "2-kings": 719, "1-chronicles": 942, "2-chronicles": 822,
  ezra: 280, nehemiah: 406, esther: 167, job: 1070, psalms: 2461, proverbs: 915,
  ecclesiastes: 222, "song-of-solomon": 117, isaiah: 1292, jeremiah: 1364,
  lamentations: 154, ezekiel: 1273, daniel: 357, hosea: 197, joel: 73, amos: 146,
  obadiah: 21, jonah: 48, micah: 105, nahum: 47, habakkuk: 56, zephaniah: 53,
  haggai: 38, zechariah: 211, malachi: 55,
  matthew: 1071, mark: 678, luke: 1151, john: 879, acts: 1007, romans: 433,
  "1-corinthians": 437, "2-corinthians": 257, galatians: 149, ephesians: 155,
  philippians: 104, colossians: 95, "1-thessalonians": 89, "2-thessalonians": 47,
  "1-timothy": 113, "2-timothy": 83, titus: 46, philemon: 25, hebrews: 303,
  james: 108, "1-peter": 105, "2-peter": 61, "1-john": 105, "2-john": 13,
  "3-john": 14, jude: 25, revelation: 404,
};
const VERSE_BUDGET_PCT = 0.25;
/** Crossway's ESV permission is capped in absolute verses across the whole work,
 * not just as a share of each book — a percentage gate alone would wave through
 * 615 verses of Psalms. Counted across every book in content/. 1,000 is the
 * standard ESV permission ceiling; CONTENT_PLAN.md budgets it across all 66 books. */
const VERSE_BUDGET_TOTAL = 1000;
let totalVersesQuoted = 0;
/** Correct-answer word sets from every book, for the cross-book near-duplicate
 * pass below: the parallel Gospels (and Samuel/Kings vs Chronicles) can end up
 * asking the same question twice in one whole-Bible quiz. */
const allAnswerWords: { id: string; words: Set<string> }[] = [];

function loadBook(bookId: string) {
  const dir = join(CONTENT_ROOT, bookId);
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf-8"));
  const readOptional = (f: string) => {
    try {
      return read(f);
    } catch {
      return undefined;
    }
  };
  return {
    book: read("book.json"),
    arcs: read("arcs.json"),
    chapters: read("chapters.json"),
    people: read("people.json"),
    events: read("events.json"),
    quotes: read("quotes.json"),
    questions: read("questions.json"),
    decks: read("decks.json"),
    journeys: readOptional("journeys.json"),
  };
}

function checkDuplicateIds(label: string, items: { id: string }[]) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`${label}: duplicate id "${item.id}"`);
    seen.add(item.id);
  }
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeForDupeCheck(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

const CHAPTER_SUMMARY_MIN_WORDS = 15;
const CHAPTER_SUMMARY_MAX_WORDS = 45;
/** Share of a book's authored questions whose correct option may be the single
 * longest. Pure chance on four options is 25%; this leaves room without letting
 * the pattern become a strategy. */
const LENGTH_TELL_MAX = 0.5;
/** Share of words two correct answers may have in common before they count as
 * the same question asked twice. */
const NEAR_DUPLICATE_OVERLAP = 0.7;

function checkBook(bookId: string) {
  const dirents = readdirSync(CONTENT_ROOT, { withFileTypes: true });
  if (!dirents.some((d) => d.isDirectory() && d.name === bookId)) {
    errors.push(`no content directory for book "${bookId}"`);
    return;
  }

  const raw = loadBook(bookId);
  const parsed = BookContentSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`schema: ${issue.path.join(".")} — ${issue.message}`);
    }
    return; // downstream checks assume valid shapes
  }
  const { book, arcs, chapters, people, events, quotes, questions, decks, journeys } = parsed.data;

  // --- ids -------------------------------------------------------------
  checkDuplicateIds("arcs", arcs);
  checkDuplicateIds("chapters", chapters);
  checkDuplicateIds("people", people);
  checkDuplicateIds("events", events);
  checkDuplicateIds("quotes", quotes);
  checkDuplicateIds("questions", questions);
  checkDuplicateIds("decks", decks);

  // --- chapter numbering ---------------------------------------------------
  const chapterNumbers = chapters.map((c) => c.number).sort((a, b) => a - b);
  const dupChapterNumbers = chapterNumbers.filter((n, i) => chapterNumbers.indexOf(n) !== i);
  if (dupChapterNumbers.length) {
    errors.push(`chapters: duplicate chapter number(s): ${[...new Set(dupChapterNumbers)].join(", ")}`);
  }
  if (chapters.length !== book.chapterCount) {
    errors.push(`chapters: expected ${book.chapterCount} chapters, found ${chapters.length}`);
  }

  const isSelection = book.coverageDepth === "selection";
  if (!isSelection) {
    // Contiguous books (narrative/sparse/argument): 1..chapterCount, no gaps.
    for (let i = 1; i <= book.chapterCount; i++) {
      if (!chapterNumbers.includes(i)) errors.push(`chapters: missing chapter ${i}`);
    }
  }

  // --- arc coverage: matches arcOrder; contiguous ranges only for non-"selection" books --
  const sortedArcs = book.arcOrder.map((id) => arcs.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  if (sortedArcs.length !== arcs.length || sortedArcs.length !== book.arcOrder.length) {
    errors.push(`arcs: arcOrder does not exactly match the set of arcs`);
  }
  // Holds for every book: a backwards range is always wrong. It used to be
  // checked only for contiguous books, leaving "selection" books unguarded.
  for (const arc of arcs) {
    if (arc.endChapter < arc.startChapter) {
      errors.push(`arcs: "${arc.id}" has endChapter (${arc.endChapter}) before startChapter (${arc.startChapter})`);
    }
  }
  // A selection arc's range is display metadata rather than membership, but it
  // still has to bracket the chapters actually assigned to it.
  if (isSelection) {
    for (const arc of arcs) {
      const members = chapters.filter((c) => c.arcId === arc.id).map((c) => c.number);
      const outside = members.filter((n) => n < arc.startChapter || n > arc.endChapter);
      if (outside.length) {
        errors.push(
          `arcs: "${arc.id}" displays range ${arc.startChapter}-${arc.endChapter} but contains chapter(s) ${outside.join(", ")}`
        );
      }
    }
  }

  if (!isSelection) {
    let expectedStart = 1;
    for (const arc of sortedArcs) {
      if (arc.startChapter !== expectedStart) {
        errors.push(`arcs: "${arc.id}" starts at ${arc.startChapter}, expected ${expectedStart} (gap or overlap)`);
      }
      expectedStart = arc.endChapter + 1;
    }
    if (sortedArcs.length && expectedStart - 1 !== book.chapterCount) {
      errors.push(`arcs: coverage ends at chapter ${expectedStart - 1}, expected ${book.chapterCount}`);
    }
  }

  // --- dangling references ------------------------------------------------
  const arcIds = new Set(arcs.map((a) => a.id));
  const eventIds = new Set(events.map((e) => e.id));
  const peopleIds = new Set(people.map((p) => p.id));
  const chapterIds = new Set(chapters.map((c) => c.id));
  const arcById = new Map(arcs.map((a) => [a.id, a]));

  for (const c of chapters) {
    if (!arcIds.has(c.arcId)) errors.push(`chapters: "${c.id}" references missing arc "${c.arcId}"`);
    if (!isSelection) {
      const arc = arcById.get(c.arcId);
      if (arc && (c.number < arc.startChapter || c.number > arc.endChapter)) {
        errors.push(`chapters: "${c.id}" (chapter ${c.number}) is assigned to arc "${arc.id}" but falls outside its range ${arc.startChapter}-${arc.endChapter}`);
      }
    }
    for (const eid of c.eventIds) {
      if (!eventIds.has(eid)) errors.push(`chapters: "${c.id}" references missing event "${eid}"`);
    }
  }
  for (const e of events) {
    if (e.citation.chapter !== e.chapter) {
      errors.push(`events: "${e.id}" citation chapter (${e.citation.chapter}) does not match event chapter (${e.chapter})`);
    }
    for (const pid of e.peopleIds) {
      if (!peopleIds.has(pid)) errors.push(`events: "${e.id}" references missing person "${pid}"`);
    }
  }
  for (const q of quotes) {
    if (!peopleIds.has(q.speakerId)) errors.push(`quotes: "${q.id}" references missing person "${q.speakerId}"`);
    // Events already got this check; quotes never did, so a quote's displayed
    // citation could disagree with the verse it actually quotes.
    if (q.citation.chapter !== q.chapter) {
      errors.push(`quotes: "${q.id}" citation chapter (${q.citation.chapter}) does not match quote chapter (${q.chapter})`);
    }
    if (q.citation.verses !== undefined && q.citation.verses !== String(q.verse)) {
      errors.push(`quotes: "${q.id}" citation verses ("${q.citation.verses}") does not match quote verse (${q.verse})`);
    }
  }

  // Every item must belong to the book whose directory it lives in — the failure
  // mode when a new book's files are copied from an existing one.
  for (const [label, items] of [
    ["arcs", arcs],
    ["chapters", chapters],
    ["events", events],
    ["quotes", quotes],
    ["questions", questions],
    ["decks", decks],
  ] as [string, { id: string; book: string }[]][]) {
    for (const item of items) {
      if (item.book !== book.id) {
        errors.push(`${label}: "${item.id}" declares book "${item.book}" but lives under "${book.id}"`);
      }
    }
  }
  for (const p of people) {
    for (const rel of p.relations) {
      if (!peopleIds.has(rel.personId)) errors.push(`people: "${p.id}" relation references missing person "${rel.personId}"`);
    }
  }
  for (const d of decks) {
    for (const eid of d.cardEventIds) {
      if (!eventIds.has(eid)) errors.push(`decks: "${d.id}" references missing event "${eid}"`);
    }
  }
  checkDuplicateIds("journeys", journeys);
  for (const j of journeys) {
    if (j.book !== book.id) errors.push(`journeys: "${j.id}" declares book "${j.book}" but lives under "${book.id}"`);
    const journeyCharacterIds = new Set(j.characters.map((c) => c.id));
    for (const c of j.characters) {
      if (!peopleIds.has(c.id)) errors.push(`journeys: "${j.id}" character references missing person "${c.id}"`);
    }
    const stopIds = new Set<string>();
    const stopOrders = new Set<number>();
    for (const s of j.stops) {
      if (stopIds.has(s.id)) errors.push(`journeys: "${j.id}" has duplicate stop id "${s.id}"`);
      stopIds.add(s.id);
      // Sorting/prev-next navigation breaks silently on a tie, so a duplicate
      // order is a real bug, not just untidy authoring.
      if (stopOrders.has(s.order)) errors.push(`journeys: "${j.id}" has duplicate stop order ${s.order} (stop "${s.id}")`);
      stopOrders.add(s.order);
      if (!eventIds.has(s.eventId)) errors.push(`journeys: "${j.id}" stop "${s.id}" references missing event "${s.eventId}"`);
      for (const cid of s.characterIds) {
        if (!journeyCharacterIds.has(cid)) {
          errors.push(`journeys: "${j.id}" stop "${s.id}" references character "${cid}" not declared in journey.characters`);
        }
      }
    }
  }
  void chapterIds;

  // --- authored questions --------------------------------------------------
  for (const q of questions) {
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      errors.push(`questions: "${q.id}" correctIndex out of range`);
    }
    const normalizedOptions = q.options.map((o) => o.trim().toLowerCase());
    if (new Set(normalizedOptions).size !== normalizedOptions.length) {
      errors.push(`questions: "${q.id}" has duplicate options`);
    }
    // Derived from the book rather than hardcoded to "genesis", so "In Psalm 23..."
    // is caught the same way "In Genesis 23..." is.
    // A "selection" book's chapters are famous *as* chapters (Psalm 23, Isaiah
    // 53, Proverbs 31), so "What is Psalm 119 about?" names its subject, not
    // its answer. The leak rule only applies to contiguous books.
    const names = [...new Set(["chapter", book.id, book.name, book.citationName ?? book.name])];
    const chapterLeak = new RegExp(`(${names.join("|")})\\s+0*${q.citation.chapter}\\b`, "i");
    if (!isSelection && chapterLeak.test(q.prompt)) {
      errors.push(`questions: "${q.id}" prompt leaks its own chapter reference (${q.citation.chapter})`);
    }
  }

  // --- "who says this" is for people, not God -----------------------------
  // A quote spoken by God/the LORD makes a poor speaker question (in most
  // books it's the obvious answer) and the whole-Bible pool is meant to ask
  // about people, Jesus included. Warned, not failed: the existing books
  // predate the rule — see CONTENT_PLAN.md's retro tasks.
  const personById = new Map(people.map((p) => [p.id, p]));
  for (const q of quotes) {
    const name = personById.get(q.speakerId)?.name ?? "";
    if (/^(god|the lord|lord)$/i.test(name.trim())) {
      warnings.push(`quotes: "${q.id}" is spoken by ${name}; speaker questions are for people only, so this quote should go`);
    }
  }

  // --- authored prompts should ask what happens, not what it means --------
  // See DESIGN.md's "Authored question prompts describe what happens" rule.
  // A heuristic, so a warning: "What does the flood narrative show about..."
  // is the pattern, "What does Jacob do..." is fine.
  const meaningPrompt = /\b(what|which) (theme|does .+ (show|reveal|teach|illustrate|demonstrate|symbolize|represent)|is the significance)\b/i;
  for (const q of questions) {
    if (meaningPrompt.test(q.prompt)) {
      warnings.push(`questions: "${q.id}" asks what something means rather than what happens ("${q.prompt.slice(0, 60)}...")`);
    }
  }

  // --- authored-question density ------------------------------------------
  // The whole-Bible quiz draws 40% of a quiz from authored items, so a book
  // with almost none is under-represented there. Roughly one per two chapters
  // is the floor CONTENT_PLAN.md sets; a "selection" module is exempt (its
  // chapters are the curated highlights already).
  if (!isSelection && (book.autoGenerate ?? true) && questions.length < Math.ceil(chapters.length / 2)) {
    warnings.push(`questions: ${questions.length} authored for ${chapters.length} chapters — under the one-per-two-chapters floor`);
  }

  // --- near-duplicate authored questions --------------------------------------
  // Four questions once asked the same thing with near-identical correct answers,
  // so a single 10-question quiz could serve two or three of them. Exact-match
  // dedup misses that; compare the correct answers as word sets instead.
  const answerWords = questions.map((q) => ({
    id: q.id,
    words: new Set(
      q.options[q.correctIndex]
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    ),
  }));
  allAnswerWords.push(...answerWords.map((a) => ({ ...a, id: `${bookId}/${a.id}` })));
  for (let i = 0; i < answerWords.length; i++) {
    for (let j = i + 1; j < answerWords.length; j++) {
      const a = answerWords[i], b = answerWords[j];
      if (a.words.size < 4 || b.words.size < 4) continue;
      const shared = [...a.words].filter((w) => b.words.has(w)).length;
      const overlap = shared / Math.min(a.words.size, b.words.size);
      if (overlap > NEAR_DUPLICATE_OVERLAP) {
        errors.push(
          `questions: "${a.id}" and "${b.id}" have near-identical correct answers (${Math.round(overlap * 100)}% shared words)`
        );
      }
    }
  }

  // --- authored-answer length tell -------------------------------------------
  // The classic multiple-choice giveaway: if the correct option is reliably the
  // longest one, a reader who knows nothing scores well by picking the longest.
  // Judged over the corpus, not per question — some answers are legitimately the
  // meatiest option; what must not hold is the *pattern*.
  const longestIsCorrect = questions.filter((q) => {
    const lengths = q.options.map((o) => o.length);
    const max = Math.max(...lengths);
    return lengths[q.correctIndex] === max && lengths.filter((l) => l === max).length === 1;
  }).length;
  if (questions.length >= 10 && longestIsCorrect / questions.length > LENGTH_TELL_MAX) {
    errors.push(
      `questions: the correct option is the single longest in ${longestIsCorrect}/${questions.length} questions (${((longestIsCorrect / questions.length) * 100).toFixed(0)}%) — over the ${LENGTH_TELL_MAX * 100}% ceiling, so "pick the longest" beats knowing the material`
    );
  }

  // --- event name cleanliness ----------------------------------------------
  for (const e of events) {
    if (/[.!?]$/.test(e.name.trim())) errors.push(`events: "${e.id}" name has trailing punctuation`);
    if (/^(the moment|when)\b/i.test(e.name.trim())) errors.push(`events: "${e.id}" name is not a clean noun phrase`);
    if (/\bchapter\s+\d+\b/i.test(e.name)) errors.push(`events: "${e.id}" name leaks a chapter reference`);
  }

  // --- chapter summary parallelism ------------------------------------------
  // Note: the generated "what is chapter N about" question uses chapter *titles*,
  // not these summaries, so this band is an editorial consistency rule rather
  // than an answer-leak guard — the comment used to claim otherwise.
  for (const c of chapters) {
    const words = wordCount(c.summary);
    if (words < CHAPTER_SUMMARY_MIN_WORDS || words > CHAPTER_SUMMARY_MAX_WORDS) {
      errors.push(
        `chapters: "${c.id}" summary is ${words} words, expected ${CHAPTER_SUMMARY_MIN_WORDS}-${CHAPTER_SUMMARY_MAX_WORDS} (parallelism guard: summaries sit side by side on the chapter pages)`
      );
    }
  }

  // --- free-response grading data ------------------------------------------
  // Grading terms derive straight from title + summary (see lib/grade.ts's
  // deriveGradingTerms), so there's no separate data to require here. A
  // chapter whose title/summary/aliases yield very few significant words
  // would make minTerms degenerate to "match almost every one of them" — not
  // broken, but worth flagging so an author knows to add an alias.
  for (const c of chapters) {
    if (c.freeResponseAliases.length > 0 && !c.quizWorthy) {
      warnings.push(`chapters: "${c.id}" has freeResponseAliases but is not quizWorthy, so it's never asked`);
    }
    if (c.quizWorthy) {
      const { terms } = deriveGradingTerms(c);
      if (terms.length < 3) {
        warnings.push(
          `chapters: "${c.id}" only derives ${terms.length} significant term(s) from its title/summary/aliases — free-response grading may be too strict`
        );
      }
    }
  }

  // --- Chapter Order blurb coverage -----------------------------------------
  // components/ChapterOrderBoard.tsx falls back to `title` when a chapter
  // has no `blurb`, so a missing one doesn't break anything, but the row
  // won't identify the chapter the way a proper blurb does. Only checked
  // for non-selection books: selection-depth books are excluded from the
  // board entirely (see DESIGN.md's "Chapter Order" section), so there's
  // nothing to author there.
  if (!isSelection) {
    for (const c of chapters) {
      if (!c.blurb) {
        warnings.push(`chapters: "${c.id}" has no blurb, so its Chapter Order row falls back to the title`);
      }
    }

    // A duplicate title/blurb/summary within a book means two Chapter Order
    // rows would show identical text, making them indistinguishable.
    for (const field of ["title", "blurb", "summary"] as const) {
      const seen = new Map<string, string>();
      for (const c of chapters) {
        const value = c[field];
        if (!value) continue;
        const normalized = normalizeForDupeCheck(value);
        const dupeId = seen.get(normalized);
        if (dupeId) {
          errors.push(`chapters: "${c.id}" and "${dupeId}" have the same ${field} (after normalizing)`);
        } else {
          seen.set(normalized, c.id);
        }
      }
    }
  }

  // --- citations on every citable item --------------------------------------
  for (const e of events) if (!e.citation) errors.push(`events: "${e.id}" missing citation`);
  for (const q of quotes) if (!q.citation) errors.push(`quotes: "${q.id}" missing citation`);
  for (const q of questions) if (!q.citation) errors.push(`questions: "${q.id}" missing citation`);

  // --- ESV license budget ----------------------------------------------------
  // The contiguity rule holds regardless of whether we know the book's length,
  // so it runs unconditionally — it used to sit inside the branch below and was
  // silently skipped for any book missing from VERSE_COUNTS.
  const byChapter = new Map<number, number[]>();
  for (const q of quotes) {
    const list = byChapter.get(q.chapter) ?? [];
    list.push(q.verse);
    byChapter.set(q.chapter, list);
  }
  for (const [chapter, verses] of byChapter) {
    const sorted = [...new Set(verses)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        errors.push(
          `quotes: chapter ${chapter} has contiguous quoted verses ${sorted[i - 1]}-${sorted[i]} — license is for individual verses only`
        );
      }
    }
  }

  const uniqueQuoted = new Set(quotes.map((q) => `${q.chapter}:${q.verse}`)).size;
  totalVersesQuoted += uniqueQuoted;
  const totalVerses = VERSE_COUNTS[bookId];
  if (totalVerses) {
    const pct = uniqueQuoted / totalVerses;
    if (pct > VERSE_BUDGET_PCT) {
      errors.push(
        `quotes: ${uniqueQuoted}/${totalVerses} verses of ${bookId} quoted (${(pct * 100).toFixed(1)}%) exceeds the ${VERSE_BUDGET_PCT * 100}% budget`
      );
    }
  } else {
    console.warn(`(no verse-count reference for "${bookId}" — skipping its ESV percentage check)`);
  }

  // --- generated-question ambiguity ------------------------------------------
  // Once for the whole book, then once per arc — because /quiz/<arc> is its own
  // module with its own generated pool, and the whole-book pass alone cannot see
  // whether an arc-scoped quiz still has four options to offer.
  const bookData = { book, arcs, chapters, people, events, quotes };
  const report = (label: string, problem: { id: string; reason: string; severity?: string }) => {
    const line = `${label}: ${problem.id} — ${problem.reason}`;
    (problem.severity === "warn" ? warnings : errors).push(line);
  };
  for (const problem of findAmbiguities(bookData)) report("generated", problem);
  for (const arc of arcs) {
    const scopeChapters = chapters.filter((c) => c.arcId === arc.id).map((c) => c.number);
    for (const problem of findAmbiguities({ ...bookData, scopeChapters })) {
      report(`generated[module ${arc.id}]`, problem);
    }
  }
}

const books = readdirSync(CONTENT_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const bookId of books) checkBook(bookId);

// Cross-book near-duplicates are a warning, not an error: two Gospels asking
// about the same event can be legitimate. Within a book it stays an error above.
for (let i = 0; i < allAnswerWords.length; i++) {
  for (let j = i + 1; j < allAnswerWords.length; j++) {
    const a = allAnswerWords[i], b = allAnswerWords[j];
    if (a.id.split("/")[0] === b.id.split("/")[0]) continue;
    if (a.words.size < 4 || b.words.size < 4) continue;
    const shared = [...a.words].filter((w) => b.words.has(w)).length;
    if (shared / Math.min(a.words.size, b.words.size) > NEAR_DUPLICATE_OVERLAP) {
      warnings.push(`questions: "${a.id}" and "${b.id}" have near-identical correct answers across books`);
    }
  }
}

if (totalVersesQuoted > VERSE_BUDGET_TOTAL) {
  errors.push(
    `quotes: ${totalVersesQuoted} verses quoted across all books exceeds the ${VERSE_BUDGET_TOTAL}-verse ESV permission cap`
  );
}

if (warnings.length) {
  console.warn(`\ncheck:content warnings (${warnings.length}) — not failures, but content that generates nothing:\n`);
  for (const w of warnings) console.warn(`  - ${w}`);
  console.warn("");
}

if (errors.length) {
  console.error(`\ncheck:content failed with ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`check:content passed — ${books.join(", ")}`);
}
