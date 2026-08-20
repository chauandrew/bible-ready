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
  book: { id: string };
  arcs: Arc[];
  chapters: Chapter[];
  people: Person[];
  events: Event[];
  quotes: Quote[];
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
  for (const e of events.filter((e) => e.notable)) {
    const arcId = arcOf(chapters, e.chapter);
    const sameArc = arcId ? eventsInArc(events, chapters, arcId) : events;
    const pool = Array.from(new Set(sameArc.map((x) => String(x.chapter)))).filter(
      (c) => c !== String(e.chapter)
    );
    const fallbackPool =
      pool.length >= 3 ? pool : Array.from(new Set(events.map((x) => String(x.chapter)))).filter((c) => c !== String(e.chapter));
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
  for (const e of events.filter((e) => e.notable && e.place)) {
    const place = e.place!;
    const arcId = arcOf(chapters, e.chapter);
    const sameArc = arcId ? eventsInArc(events, chapters, arcId) : events;
    const placesInArc = sameArc.map((x) => x.place).filter((p): p is string => !!p);
    const pool = Array.from(new Set(placesInArc)).filter((p) => p !== place);
    out.push({
      kind: "generated",
      id: `gen:location:${e.id}`,
      type: "location",
      prompt: `Where does this happen: ${e.name}?`,
      correctAnswer: place,
      distractorPool: pool,
      citation: { book: book.id, chapter: e.chapter },
    });
  }
  return out;
}

export function generateSpeakerQuestions(data: BookData): GeneratedMC[] {
  const { quotes, chapters, people, book } = data;
  const out: GeneratedMC[] = [];
  for (const q of quotes) {
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
    const pool = Array.from(new Set(sameArcSpeakers.map((id) => personName(people, id)))).filter(
      (name) => name !== personName(people, q.speakerId)
    );
    const fallback = pool.length >= 3 ? pool : people.map((p) => p.name).filter((n) => n !== personName(people, q.speakerId));
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
  for (const c of chapters) {
    const sameArc = chapters.filter((x) => x.arcId === c.arcId && x.id !== c.id);
    const pool = Array.from(new Set(sameArc.map((x) => x.title)));
    const fallback = pool.length >= 3 ? pool : Array.from(new Set(chapters.map((x) => x.title))).filter((t) => t !== c.title);
    out.push({
      kind: "generated",
      id: `gen:summary:${c.id}`,
      type: "chapter-summary",
      prompt: `What is ${book.id === "genesis" ? "Genesis" : book.id} ${c.number} about?`,
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
    const arcEvents = eventsInArc(events, chapters, arc.id).filter((e) => e.notable && e.place);
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
      prompt: `Match each event in "${arc.name}" to where it happens.`,
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
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function findAmbiguities(data: BookData): AmbiguityProblem[] {
  const problems: AmbiguityProblem[] = [];

  for (const item of [
    ...generateChapterQuestions(data),
    ...generateLocationQuestions(data),
    ...generateSpeakerQuestions(data),
    ...generateChapterSummaryQuestions(data),
  ]) {
    if (item.distractorPool.length < 3) {
      problems.push({ id: item.id, reason: `only ${item.distractorPool.length} distinct distractors available (need 3)` });
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
