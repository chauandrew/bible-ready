import type { Arc, Chapter, Event, Person, Quote } from "../content/schema";
import { mulberry32, hashSeed, shuffle } from "./rng";

/**
 * The generator: turns the events/chapters/quotes backbone into quiz items.
 * Runs in two modes from the same code path:
 *  - exhaustively, at build time (scripts/check-content.ts), to prove the
 *    whole output space is unambiguous before anyone sees it
 *  - seeded, at runtime, to pick and shuffle a slice of that already-proven
 *    space for one quiz
 *
 * ponytail: distractor-pool sizing (>=3 distinct wrong options) is the
 * ambiguity guard, not full semantic dedup of prompts. Near-duplicate event
 * names across chapters are caught by a normalized-string heuristic, not an
 * embedding/semantic check. Upgrade path: embedding similarity if authored
 * event names ever collide in meaning without colliding in text.
 */

export interface BookData {
  book: { id: string; name: string; citationName?: string; placeAsk?: string; placeMatchAsk?: string };
  arcs: Arc[];
  chapters: Chapter[];
  people: Person[];
  events: Event[];
  quotes: Quote[];
  /**
   * Restricts which items are *asked about* (an arc-scoped quiz), without
   * shrinking the pools the distractors come from. Passing an arc's chapters
   * here rather than pre-filtering the whole BookData matters: a 2-chapter arc
   * has no 3 distinct chapters of its own to use as wrong answers, and
   * pre-filtering silently produced 2-option questions that check:content —
   * which only ever saw the whole book — could not see.
   */
  scopeChapters?: number[];
}

function inScope(data: BookData, chapter: number): boolean {
  return !data.scopeChapters || data.scopeChapters.includes(chapter);
}

/** Distractors for the fallback path, nearest first. */
const FALLBACK_POOL_SIZE = 6;

function nearest<T>(items: T[], distance: (x: T) => number, n: number): T[] {
  return [...items].sort((a, b) => distance(a) - distance(b)).slice(0, n);
}

function bookLabel(book: BookData["book"]): string {
  return book.citationName ?? book.name;
}

/** Words too generic to count as a place or a speaker naming itself. */
const LEAK_STOPWORDS = new Set(["the", "of", "land", "city", "house", "and", "at", "in", "sea"]);

function leaks(haystack: string, needle: string): boolean {
  const words = new Set(normalize(haystack).split(" "));
  return normalize(needle)
    .split(" ")
    .some((w) => w.length >= 4 && !LEAK_STOPWORDS.has(w) && words.has(w));
}

/**
 * "Where does this happen: Israel crosses the Red Sea on dry ground?" answers
 * itself. Such events are skipped for location and match questions rather than
 * rejected outright, because `name` is also what sequence questions, flashcards
 * and the chapter pages display — the name is right, it just cannot be asked
 * this particular question. check:content reports these as warnings.
 */
export function namesItsOwnPlace(e: Event): boolean {
  return !!e.place && leaks(e.name, e.place);
}

/** Same idea for "who says this": a verse carrying "And God said to Noah," gives
 * the speaker away, so it generates no speaker question. */
function namesItsOwnSpeaker(q: Quote, people: Person[]): boolean {
  return leaks(q.text, personName(people, q.speakerId));
}

export type GeneratedMC = {
  kind: "generated";
  id: string;
  type: "chapter" | "location" | "speaker" | "chapter-summary";
  prompt: string;
  correctAnswer: string;
  distractorPool: string[]; // deduped, excludes correctAnswer
  citation: { book: string; chapter: number; verses?: string };
};

export type GeneratedSequence = {
  kind: "generated";
  id: string;
  type: "sequence";
  prompt: string;
  itemsInOrder: string[]; // correct order, 4-6 items
  citation: { book: string; chapter: number };
};

export type GeneratedMatch = {
  kind: "generated";
  id: string;
  type: "match";
  prompt: string;
  pairs: { left: string; right: string }[]; // 4-6 pairs, rights all distinct
  citation: { book: string; chapter: number };
};

export type GeneratedItem = GeneratedMC | GeneratedSequence | GeneratedMatch;

function personName(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.name ?? id;
}

function arcOf(chapters: Chapter[], chapterNumber: number): string | undefined {
  return chapters.find((c) => c.number === chapterNumber)?.arcId;
}

function eventsInArc(events: Event[], chapters: Chapter[], arcId: string): Event[] {
  const chapterNumbers = new Set(chapters.filter((c) => c.arcId === arcId).map((c) => c.number));
  return events.filter((e) => chapterNumbers.has(e.chapter));
}

// ---------------------------------------------------------------------------
// Templates — one generated item per underlying fact, exhaustively
// ---------------------------------------------------------------------------

export function generateChapterQuestions(data: BookData): GeneratedMC[] {
  const { events, chapters, book } = data;
  const out: GeneratedMC[] = [];
  const allChapters = Array.from(new Set(events.map((x) => x.chapter)));
  for (const e of events.filter((e) => e.notable && inScope(data, e.chapter))) {
    const arcId = arcOf(chapters, e.chapter);
    const sameArc = arcId ? eventsInArc(events, chapters, arcId) : events;
    const pool = Array.from(new Set(sameArc.map((x) => String(x.chapter)))).filter(
      (c) => c !== String(e.chapter)
    );
    // Nearest chapters, not random book-wide ones: "which chapter" is no test
    // at all when the wrong answers are forty chapters away.
    const fallbackPool =
      pool.length >= 3
        ? pool
        : nearest(
            allChapters.filter((c) => c !== e.chapter),
            (c) => Math.abs(c - e.chapter),
            FALLBACK_POOL_SIZE
          ).map(String);
    out.push({
      kind: "generated",
      id: `gen:chapter:${e.id}`,
      type: "chapter",
      prompt: `In which chapter does this happen: ${e.name}?`,
      correctAnswer: String(e.chapter),
      distractorPool: fallbackPool,
      citation: { book: book.id, chapter: e.chapter },
    });
  }
  return out;
}

/** Only events with `place` set generate a "where does this happen" question —
 * most events aren't about a place, so this is opt-in per event, not every
 * notable event. See the comment on EventSchema.place. */
export function generateLocationQuestions(data: BookData): GeneratedMC[] {
  const { events, chapters, book } = data;
  const out: GeneratedMC[] = [];
  const placed = events.filter((e) => e.place && !namesItsOwnPlace(e));
  for (const e of placed.filter((e) => e.notable && inScope(data, e.chapter))) {
    const place = e.place!;
    const arcId = arcOf(chapters, e.chapter);
    const sameArc = arcId ? eventsInArc(events, chapters, arcId) : events;
    const placesInArc = sameArc.map((x) => x.place).filter((p): p is string => !!p);
    const pool = Array.from(new Set(placesInArc)).filter((p) => p !== place);
    // Without a fallback, an arc holding only two real locations produced no
    // usable question at all and forced the location to be dropped from the
    // content. Fall back to the nearest places elsewhere in the book instead.
    const fallback =
      pool.length >= 3
        ? pool
        : Array.from(
            new Set(
              nearest(
                placed.filter((x) => x.place !== place),
                (x) => Math.abs(x.chapter - e.chapter),
                FALLBACK_POOL_SIZE * 2
              ).map((x) => x.place!)
            )
          ).slice(0, FALLBACK_POOL_SIZE);
    out.push({
      kind: "generated",
      id: `gen:location:${e.id}`,
      type: "location",
      prompt: `${book.placeAsk ?? "Where does this happen"}: ${e.name}?`,
      correctAnswer: place,
      distractorPool: fallback,
      citation: { book: book.id, chapter: e.chapter },
    });
  }
  return out;
}

export function generateSpeakerQuestions(data: BookData): GeneratedMC[] {
  const { quotes, chapters, people, book } = data;
  const out: GeneratedMC[] = [];
  for (const q of quotes.filter((q) => inScope(data, q.chapter) && !namesItsOwnSpeaker(q, people))) {
    const arcId = arcOf(chapters, q.chapter);
    const sameArcSpeakers = arcId
      ? Array.from(
          new Set(
            data.events
              .filter((e) => arcOf(chapters, e.chapter) === arcId)
              .flatMap((e) => e.peopleIds)
          )
        )
      : people.map((p) => p.id);
    const correct = personName(people, q.speakerId);
    const pool = Array.from(new Set(sameArcSpeakers.map((id) => personName(people, id)))).filter(
      (name) => name !== correct
    );
    // Fall back to the people who turn up nearest this quote in the book, not
    // the whole cast — Potiphar is not a credible answer for a line in Genesis 3.
    const fallback =
      pool.length >= 3
        ? pool
        : Array.from(
            new Set(
              nearest(
                people.filter((p) => p.id !== q.speakerId),
                (p) => Math.abs(p.firstAppearance.chapter - q.chapter),
                FALLBACK_POOL_SIZE
              ).map((p) => p.name)
            )
          ).filter((n) => n !== correct);
    out.push({
      kind: "generated",
      id: `gen:speaker:${q.id}`,
      type: "speaker",
      prompt: `Who says this: "${q.text}" (ESV)?`,
      correctAnswer: personName(people, q.speakerId),
      distractorPool: fallback,
      citation: { book: book.id, chapter: q.chapter, verses: String(q.verse) },
    });
  }
  return out;
}

export function generateChapterSummaryQuestions(data: BookData): GeneratedMC[] {
  const { chapters, book } = data;
  const out: GeneratedMC[] = [];
  for (const c of chapters.filter((c) => inScope(data, c.number))) {
    const sameArc = chapters.filter((x) => x.arcId === c.arcId && x.id !== c.id);
    const pool = Array.from(new Set(sameArc.map((x) => x.title))).filter((t) => t !== c.title);
    const fallback =
      pool.length >= 3
        ? pool
        : Array.from(
            new Set(
              nearest(
                chapters.filter((x) => x.id !== c.id),
                (x) => Math.abs(x.number - c.number),
                FALLBACK_POOL_SIZE
              ).map((x) => x.title)
            )
          ).filter((t) => t !== c.title);
    out.push({
      kind: "generated",
      id: `gen:summary:${c.id}`,
      type: "chapter-summary",
      prompt: `What is ${bookLabel(book)} ${c.number} about?`,
      correctAnswer: c.title,
      distractorPool: fallback,
      citation: { book: book.id, chapter: c.number },
    });
  }
  return out;
}

export function generateSequenceQuestions(data: BookData): GeneratedSequence[] {
  const { arcs, chapters, events, book } = data;
  const out: GeneratedSequence[] = [];
  for (const arc of arcs) {
    const arcChapters = chapters.filter((c) => c.arcId === arc.id).map((c) => c.number).sort((a, b) => a - b);
    if (!arcChapters.some((n) => inScope(data, n))) continue;
    // "Put these in order" only means something when the arc actually runs in
    // chapter order. A thematic arc of a "selection" book (psalms 1, 19, 119)
    // has no narrative sequence — ordering it just tests canonical numbering.
    if (arcChapters.some((n, i) => i > 0 && n !== arcChapters[i - 1] + 1)) continue;
    const arcEvents = eventsInArc(events, chapters, arc.id)
      .filter((e) => e.notable)
      .sort((a, b) => (a.chapter - b.chapter) || (a.order - b.order))
      .slice(0, 6);
    if (arcEvents.length < 4) continue;
    out.push({
      kind: "generated",
      id: `gen:sequence:${arc.id}`,
      type: "sequence",
      prompt: `Put these events from "${arc.name}" in order.`,
      itemsInOrder: arcEvents.map((e) => e.name),
      citation: { book: book.id, chapter: arc.startChapter },
    });
  }
  return out;
}

export function generateMatchQuestions(data: BookData): GeneratedMatch[] {
  const { arcs, chapters, events, book } = data;
  const out: GeneratedMatch[] = [];
  for (const arc of arcs) {
    // Only events with a place set are eligible — matching only makes sense
    // where the location is actually the point (see EventSchema.place).
    if (!chapters.some((c) => c.arcId === arc.id && inScope(data, c.number))) continue;
    const arcEvents = eventsInArc(events, chapters, arc.id).filter(
      (e) => e.notable && e.place && !namesItsOwnPlace(e)
    );
    const seenPlaces = new Set<string>();
    const pairs: { left: string; right: string }[] = [];
    for (const e of arcEvents) {
      const place = e.place!;
      if (seenPlaces.has(place)) continue; // rights must be distinct for a well-defined match
      seenPlaces.add(place);
      pairs.push({ left: e.name, right: place });
      if (pairs.length === 6) break;
    }
    if (pairs.length < 4) continue;
    out.push({
      kind: "generated",
      id: `gen:match:${arc.id}`,
      type: "match",
      prompt: `Match each event in "${arc.name}" ${book.placeMatchAsk ?? "to where it happens"}.`,
      pairs,
      citation: { book: book.id, chapter: arc.startChapter },
    });
  }
  return out;
}

export function generateAll(data: BookData): GeneratedItem[] {
  return [
    ...generateChapterQuestions(data),
    ...generateLocationQuestions(data),
    ...generateSpeakerQuestions(data),
    ...generateChapterSummaryQuestions(data),
    ...generateSequenceQuestions(data),
    ...generateMatchQuestions(data),
  ];
}

// ---------------------------------------------------------------------------
// Runtime: seeded selection + option shuffling of an already-validated item
// ---------------------------------------------------------------------------

export interface RuntimeMC {
  kind: "generated";
  id: string;
  type: GeneratedMC["type"];
  prompt: string;
  options: string[];
  correctIndex: number;
  citation: GeneratedMC["citation"];
}

export function toRuntimeMC(item: GeneratedMC, seed: number): RuntimeMC {
  const rand = mulberry32(seed);
  const distractors = shuffle(item.distractorPool, rand).slice(0, 3);
  const options = shuffle([item.correctAnswer, ...distractors], rand);
  return {
    kind: "generated",
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    options,
    correctIndex: options.indexOf(item.correctAnswer),
    citation: item.citation,
  };
}

/** Deterministically pick `count` items from the exhaustive generated pool for a given seed string. */
export function pickGenerated<T extends { id: string }>(pool: T[], seedStr: string, count: number): T[] {
  const rand = mulberry32(hashSeed(seedStr));
  return shuffle(pool, rand).slice(0, count);
}

// ---------------------------------------------------------------------------
// Whole-corpus ambiguity validation (used by scripts/check-content.ts)
// ---------------------------------------------------------------------------

export interface AmbiguityProblem {
  id: string;
  reason: string;
  /** "warn" means the generator already refuses to ship the item, so nothing
   * broken reaches a reader — the content just isn't earning its keep. */
  severity?: "error" | "warn";
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}


export function findAmbiguities(data: BookData): AmbiguityProblem[] {
  const problems: AmbiguityProblem[] = [];

  // A distractor that points at a specific chapter names a different question's
  // subject — e.g. an option reading "Psalm 51" offered on Psalm 51's own item.
  const chapterRef = new RegExp(`\\b(chapter|${bookLabel(data.book)}|${data.book.name})\\s+\\d+\\b`, "i");

  for (const item of [
    ...generateChapterQuestions(data),
    ...generateLocationQuestions(data),
    ...generateSpeakerQuestions(data),
    ...generateChapterSummaryQuestions(data),
  ]) {
    if (item.distractorPool.length < 3) {
      problems.push({ id: item.id, reason: `only ${item.distractorPool.length} distinct distractors available (need 3)` });
    }
    if (item.type !== "chapter") {
      for (const d of item.distractorPool) {
        if (chapterRef.test(d)) {
          problems.push({ id: item.id, reason: `distractor "${d}" names a specific chapter, identifying some other item's subject` });
        }
      }
    }
  }

  // Everything below inspects the whole corpus rather than one module's slice,
  // so a scoped run would just repeat the same findings once per arc.
  if (data.scopeChapters) return problems;

  // Content that can't be asked about. The generator skips these, so they are
  // warnings, not failures — but a `place` or a quote that generates nothing is
  // usually not what the author intended.
  for (const e of data.events) {
    if (namesItsOwnPlace(e)) {
      problems.push({
        id: e.id,
        severity: "warn",
        reason: `place "${e.place}" is named in the event's own name, so no location or match question is generated for it`,
      });
    }
  }
  for (const q of data.quotes) {
    if (namesItsOwnSpeaker(q, data.people)) {
      problems.push({
        id: q.id,
        severity: "warn",
        reason: `quote text names its speaker ("${personName(data.people, q.speakerId)}"), so no speaker question is generated for it`,
      });
    }
  }

  for (const item of generateMatchQuestions(data)) {
    const rights = new Set(item.pairs.map((p) => p.right));
    if (rights.size !== item.pairs.length) {
      problems.push({ id: item.id, reason: "match pairs have duplicate right-hand values" });
    }
  }

  // Near-duplicate event names across different chapters: a student could
  // reasonably answer either chapter for a "which chapter" question.
  const byNormalizedName = new Map<string, Event[]>();
  for (const e of data.events) {
    const key = normalize(e.name);
    const list = byNormalizedName.get(key) ?? [];
    list.push(e);
    byNormalizedName.set(key, list);
  }
  for (const [name, list] of byNormalizedName) {
    const distinctChapters = new Set(list.map((e) => e.chapter));
    if (distinctChapters.size > 1) {
      problems.push({
        id: list.map((e) => e.id).join(","),
        reason: `event name "${name}" is shared across chapters ${[...distinctChapters].join(", ")}`,
      });
    }
  }

  // Duplicate order within the same chapter breaks sequence ordering.
  const byChapterOrder = new Map<string, Event[]>();
  for (const e of data.events) {
    const key = `${e.chapter}:${e.order}`;
    const list = byChapterOrder.get(key) ?? [];
    list.push(e);
    byChapterOrder.set(key, list);
  }
  for (const [key, list] of byChapterOrder) {
    if (list.length > 1) {
      problems.push({ id: list.map((e) => e.id).join(","), reason: `duplicate order within chapter (${key})` });
    }
  }

  // Duplicate chapter titles within an arc break chapter-summary distractors.
  const byArc = new Map<string, Chapter[]>();
  for (const c of data.chapters) {
    const list = byArc.get(c.arcId) ?? [];
    list.push(c);
    byArc.set(c.arcId, list);
  }
  for (const [arcId, list] of byArc) {
    const titles = list.map((c) => normalize(c.title));
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    if (dupes.length) {
      problems.push({ id: arcId, reason: `duplicate chapter titles within arc: ${[...new Set(dupes)].join(", ")}` });
    }
  }

  return problems;
}

export interface RuntimeSequence {
  kind: "generated";
  id: string;
  type: "sequence";
  prompt: string;
  displayItems: string[]; // shuffled for the player to reorder
  correctOrder: string[]; // the answer key
  citation: GeneratedSequence["citation"];
}

export function toRuntimeSequence(item: GeneratedSequence, seed: number): RuntimeSequence {
  const rand = mulberry32(seed);
  return {
    kind: "generated",
    id: item.id,
    type: "sequence",
    prompt: item.prompt,
    displayItems: shuffle(item.itemsInOrder, rand),
    correctOrder: item.itemsInOrder,
    citation: item.citation,
  };
}

export interface RuntimeMatch {
  kind: "generated";
  id: string;
  type: "match";
  prompt: string;
  lefts: string[];
  rights: string[]; // shuffled independently of lefts
  correctPairs: { left: string; right: string }[];
  citation: GeneratedMatch["citation"];
}

export function toRuntimeMatch(item: GeneratedMatch, seed: number): RuntimeMatch {
  const rand = mulberry32(seed);
  return {
    kind: "generated",
    id: item.id,
    type: "match",
    prompt: item.prompt,
    lefts: shuffle(item.pairs.map((p) => p.left), rand),
    rights: shuffle(item.pairs.map((p) => p.right), rand),
    correctPairs: item.pairs,
    citation: item.citation,
  };
}
