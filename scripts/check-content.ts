#!/usr/bin/env -S npx tsx
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BookContentSchema } from "../content/schema";
import { findAmbiguities } from "../lib/generate";

/**
 * The one build gate for content. Fails loudly on anything that would ship a
 * broken reference, a leaked answer, or an ESV license overage. Run with:
 *   npm run check:content
 */

const CONTENT_ROOT = join(__dirname, "..", "content");
const errors: string[] = [];

// Standard ESV verse counts per book (versification matches KJV/ESV for
// nearly all books). Only books actually present in content/ are checked;
// this is deliberately not filled out for all 66 until they're needed.
const VERSE_COUNTS: Record<string, number> = {
  genesis: 1533,
};
const VERSE_BUDGET_PCT = 0.25;

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
  if (!isSelection) {
    let expectedStart = 1;
    for (const arc of sortedArcs) {
      if (arc.startChapter !== expectedStart) {
        errors.push(`arcs: "${arc.id}" starts at ${arc.startChapter}, expected ${expectedStart} (gap or overlap)`);
      }
      if (arc.endChapter < arc.startChapter) {
        errors.push(`arcs: "${arc.id}" has endChapter before startChapter`);
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
    const chapterLeak = new RegExp(`(chapter|genesis)\\s+0*${q.citation.chapter}\\b`, "i");
    if (chapterLeak.test(q.prompt)) {
      errors.push(`questions: "${q.id}" prompt leaks its own chapter reference (${q.citation.chapter})`);
    }
  }

  // --- event name cleanliness ----------------------------------------------
  for (const e of events) {
    if (/[.!?]$/.test(e.name.trim())) errors.push(`events: "${e.id}" name has trailing punctuation`);
    if (/^(the moment|when)\b/i.test(e.name.trim())) errors.push(`events: "${e.id}" name is not a clean noun phrase`);
    if (/\bchapter\s+\d+\b/i.test(e.name)) errors.push(`events: "${e.id}" name leaks a chapter reference`);
  }

  // --- chapter summary parallelism ------------------------------------------
  for (const c of chapters) {
    const words = wordCount(c.summary);
    if (words < CHAPTER_SUMMARY_MIN_WORDS || words > CHAPTER_SUMMARY_MAX_WORDS) {
      errors.push(
        `chapters: "${c.id}" summary is ${words} words, expected ${CHAPTER_SUMMARY_MIN_WORDS}-${CHAPTER_SUMMARY_MAX_WORDS} (parallelism guard, prevents length leaking the answer)`
      );
    }
  }

  // --- citations on every citable item --------------------------------------
  for (const e of events) if (!e.citation) errors.push(`events: "${e.id}" missing citation`);
  for (const q of quotes) if (!q.citation) errors.push(`quotes: "${q.id}" missing citation`);
  for (const q of questions) if (!q.citation) errors.push(`questions: "${q.id}" missing citation`);

  // --- ESV license budget ----------------------------------------------------
  const totalVerses = VERSE_COUNTS[bookId];
  if (totalVerses) {
    const byChapter = new Map<number, number[]>();
    for (const q of quotes) {
      const list = byChapter.get(q.chapter) ?? [];
      list.push(q.verse);
      byChapter.set(q.chapter, list);
    }
    for (const [chapter, verses] of byChapter) {
      const sorted = [...verses].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          errors.push(
            `quotes: chapter ${chapter} has contiguous quoted verses ${sorted[i - 1]}-${sorted[i]} — license is for individual verses only`
          );
        }
      }
    }
    const uniqueQuoted = new Set(quotes.map((q) => `${q.chapter}:${q.verse}`)).size;
    const pct = uniqueQuoted / totalVerses;
    if (pct > VERSE_BUDGET_PCT) {
      errors.push(
        `quotes: ${uniqueQuoted}/${totalVerses} verses of ${bookId} quoted (${(pct * 100).toFixed(1)}%) exceeds the ${VERSE_BUDGET_PCT * 100}% budget`
      );
    }
  } else {
    console.warn(`(no verse-count reference for "${bookId}" — skipping ESV budget check)`);
  }

  // --- generated-question ambiguity (whole corpus) ----------------------------
  const ambiguities = findAmbiguities({ book, arcs, chapters, people, events, quotes });
  for (const problem of ambiguities) {
    errors.push(`generated: ${problem.id} — ${problem.reason}`);
  }
}

const books = readdirSync(CONTENT_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const bookId of books) checkBook(bookId);

if (errors.length) {
  console.error(`\ncheck:content failed with ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`check:content passed — ${books.join(", ")}`);
}
