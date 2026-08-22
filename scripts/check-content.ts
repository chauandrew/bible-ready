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

// Standard ESV verse counts per book (versification matches KJV/ESV for
// nearly all books). Only books actually present in content/ are checked;
// this is deliberately not filled out for all 66 until they're needed.
const VERSE_COUNTS: Record<string, number> = {
  genesis: 1533,
  exodus: 1213,
  psalms: 2461,
  john: 879,
};
const VERSE_BUDGET_PCT = 0.25;
/** Crossway's ESV permission is capped in absolute verses across the whole work,
 * not just as a share of each book — a percentage gate alone would wave through
 * 615 verses of Psalms. Counted across every book in content/. */
const VERSE_BUDGET_TOTAL = 500;
let totalVersesQuoted = 0;

function loadBook(bookId: string) {
  const dir = join(CONTENT_ROOT, bookId);
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf-8"));
  return {
    book: read("book.json"),
    arcs: read("arcs.json"),
    chapters: read("chapters.json"),
    people: read("people.json"),
    events: read("events.json"),
    quotes: read("quotes.json"),
    questions: read("questions.json"),
    decks: read("decks.json"),
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
  const { book, arcs, chapters, people, events, quotes, questions, decks } = parsed.data;

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
    const names = [...new Set(["chapter", book.id, book.name, book.citationName ?? book.name])];
    const chapterLeak = new RegExp(`(${names.join("|")})\\s+0*${q.citation.chapter}\\b`, "i");
    if (chapterLeak.test(q.prompt)) {
      errors.push(`questions: "${q.id}" prompt leaks its own chapter reference (${q.citation.chapter})`);
    }
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
