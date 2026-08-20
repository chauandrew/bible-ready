import genesisBookJson from "@/content/genesis/book.json";
import genesisArcsJson from "@/content/genesis/arcs.json";
import genesisChaptersJson from "@/content/genesis/chapters.json";
import genesisPeopleJson from "@/content/genesis/people.json";
import genesisEventsJson from "@/content/genesis/events.json";
import genesisQuotesJson from "@/content/genesis/quotes.json";
import genesisQuestionsJson from "@/content/genesis/questions.json";
import genesisDecksJson from "@/content/genesis/decks.json";
import exodusBookJson from "@/content/exodus/book.json";
import exodusArcsJson from "@/content/exodus/arcs.json";
import exodusChaptersJson from "@/content/exodus/chapters.json";
import exodusPeopleJson from "@/content/exodus/people.json";
import exodusEventsJson from "@/content/exodus/events.json";
import exodusQuotesJson from "@/content/exodus/quotes.json";
import exodusQuestionsJson from "@/content/exodus/questions.json";
import exodusDecksJson from "@/content/exodus/decks.json";
import psalmsBookJson from "@/content/psalms/book.json";
import psalmsArcsJson from "@/content/psalms/arcs.json";
import psalmsChaptersJson from "@/content/psalms/chapters.json";
import psalmsPeopleJson from "@/content/psalms/people.json";
import psalmsEventsJson from "@/content/psalms/events.json";
import psalmsQuotesJson from "@/content/psalms/quotes.json";
import psalmsQuestionsJson from "@/content/psalms/questions.json";
import psalmsDecksJson from "@/content/psalms/decks.json";
import {
  BookContentSchema,
  type Arc,
  type AuthoredQuestion,
  type Book,
  type BookContent,
  type Chapter,
  type Deck,
  type Event,
  type Person,
  type Quote,
} from "@/content/schema";

/**
 * The only module that touches content JSON directly. Everything else reads
 * through the lookups below. If a database is ever needed, this file is the
 * one thing that changes.
 *
 * Genesis is the only book with full page-level UI (study chapters/people,
 * print, per-arc quizzes) — see DESIGN.md's "Multi-book UI wiring" gap. Exodus
 * and Psalms are loaded here too so their content can feed the whole-Bible /
 * multi-book quiz, diagnostic, and flashcard modes below, without giving them
 * their own book sections yet.
 */
const raw = BookContentSchema.parse({
  book: genesisBookJson,
  arcs: genesisArcsJson,
  chapters: genesisChaptersJson,
  people: genesisPeopleJson,
  events: genesisEventsJson,
  quotes: genesisQuotesJson,
  questions: genesisQuestionsJson,
  decks: genesisDecksJson,
});

const exodusContent: BookContent = BookContentSchema.parse({
  book: exodusBookJson,
  arcs: exodusArcsJson,
  chapters: exodusChaptersJson,
  people: exodusPeopleJson,
  events: exodusEventsJson,
  quotes: exodusQuotesJson,
  questions: exodusQuestionsJson,
  decks: exodusDecksJson,
});

const psalmsContent: BookContent = BookContentSchema.parse({
  book: psalmsBookJson,
  arcs: psalmsArcsJson,
  chapters: psalmsChaptersJson,
  people: psalmsPeopleJson,
  events: psalmsEventsJson,
  quotes: psalmsQuotesJson,
  questions: psalmsQuestionsJson,
  decks: psalmsDecksJson,
});

export const genesis: Book = raw.book;
export const arcs: Arc[] = raw.arcs;
export const chapters: Chapter[] = raw.chapters;
export const people: Person[] = raw.people;
export const events: Event[] = raw.events;
export const quotes: Quote[] = raw.quotes;
export const authoredQuestions: AuthoredQuestion[] = raw.questions;
export const decks: Deck[] = raw.decks;

/** Every loaded book's full content bundle, keyed by book id — the source for
 * the whole-Bible / multi-book modes. `genesis` above stays the primary book. */
const booksContent: Record<string, BookContent> = {
  [raw.book.id]: raw,
  [exodusContent.book.id]: exodusContent,
  [psalmsContent.book.id]: psalmsContent,
};

/** Book metadata for every loaded book, for "which books do you want to include" pickers. */
export const bookRegistry: Book[] = Object.values(booksContent).map((c) => c.book);

// ---------------------------------------------------------------------------
// O(1) lookups, built once at import.
// ---------------------------------------------------------------------------

export const chapterByNumber = new Map<number, Chapter>(chapters.map((c) => [c.number, c]));
export const arcById = new Map<string, Arc>(arcs.map((a) => [a.id, a]));
export const personById = new Map<string, Person>(people.map((p) => [p.id, p]));
export const eventById = new Map<string, Event>(events.map((e) => [e.id, e]));
export const quoteById = new Map<string, Quote>(quotes.map((q) => [q.id, q]));
export const questionById = new Map<string, AuthoredQuestion>(authoredQuestions.map((q) => [q.id, q]));
export const deckById = new Map<string, Deck>(decks.map((d) => [d.id, d]));

const eventsByChapterMap = new Map<number, Event[]>();
for (const e of events) {
  const list = eventsByChapterMap.get(e.chapter) ?? [];
  list.push(e);
  eventsByChapterMap.set(e.chapter, list);
}
for (const list of eventsByChapterMap.values()) list.sort((a, b) => a.order - b.order);

const eventsByArcMap = new Map<string, Event[]>();
for (const c of chapters) {
  const arcEvents = eventsByChapterMap.get(c.number) ?? [];
  const list = eventsByArcMap.get(c.arcId) ?? [];
  list.push(...arcEvents);
  eventsByArcMap.set(c.arcId, list);
}

export function eventsForChapter(chapterNumber: number): Event[] {
  return eventsByChapterMap.get(chapterNumber) ?? [];
}

export function eventsForArc(arcId: string): Event[] {
  return eventsByArcMap.get(arcId) ?? [];
}

/** Membership is by chapter.arcId, not the arc's startChapter/endChapter range — the
 * range is display metadata only, so this also works for non-contiguous "selection"
 * books (e.g. a curated set of famous psalms) where a range can't express membership. */
export function chaptersForArc(arcId: string): Chapter[] {
  return chapters.filter((c) => c.arcId === arcId).sort((a, b) => a.number - b.number);
}

export function personsForEvent(event: Event): Person[] {
  return event.peopleIds.map((id) => personById.get(id)).filter((p): p is Person => !!p);
}

/** Book id -> how it reads in a citation. One entry per loaded book; `citationName`
 * exists for books whose citation form differs from their name ("Psalm 23:1"). */
const citationNames = new Map<string, string>(
  Object.values(booksContent).map((c) => [c.book.id, c.book.citationName ?? c.book.name])
);

export function formatCitation(c: { book: string; chapter: number; verses?: string }): string {
  const bookName = citationNames.get(c.book) ?? c.book;
  return c.verses ? `${bookName} ${c.chapter}:${c.verses}` : `${bookName} ${c.chapter}`;
}

// ---------------------------------------------------------------------------
// Quiz module resolution: "all" or a specific arc id.
// ---------------------------------------------------------------------------

import type { BookData } from "./generate";

export const quizModuleIds: string[] = ["all", ...arcs.map((a) => a.id)];

export function dataForModule(moduleId: string): { data: BookData; questions: AuthoredQuestion[] } | null {
  if (moduleId === "all") {
    return { data: { book: genesis, arcs, chapters, people, events, quotes }, questions: authoredQuestions };
  }
  const arc = arcById.get(moduleId);
  if (!arc) return null;
  // Pass the whole book and scope by chapter rather than handing the generator a
  // pre-filtered slice: an arc restricts what gets *asked*, but its distractors
  // still need the book-wide pools (a 2-chapter arc can't supply 3 wrong chapters).
  const chapterNumbers = chaptersForArc(arc.id).map((c) => c.number);
  return {
    data: { book: genesis, arcs, chapters, people, events, quotes, scopeChapters: chapterNumbers },
    questions: authoredQuestions.filter((q) => chapterNumbers.includes(q.citation.chapter)),
  };
}

// ---------------------------------------------------------------------------
// Whole-Bible / multi-book modes: one BookData per selected book, not a merged
// pool. Several person ids collide across books ("moses" is authored once for
// Exodus and again for Psalms, with different summaries), so lookups stay
// scoped per book rather than flattened into one global map.
// ---------------------------------------------------------------------------

/** One BookData + its authored questions per requested book id, unknown ids skipped. */
export function dataForBooks(bookIds: string[]): { data: BookData; questions: AuthoredQuestion[] }[] {
  return bookIds
    .map((id) => booksContent[id])
    .filter((c): c is BookContent => !!c)
    .map((c) => ({
      data: { book: c.book, arcs: c.arcs, chapters: c.chapters, people: c.people, events: c.events, quotes: c.quotes },
      questions: c.questions,
    }));
}

/** Every flashcard from every deck in the requested books, as one merged list — used both
 * for "the whole book, not just one category deck" and for "multiple books at a time". */
export interface Flashcard {
  front: string;
  /** A few-word headline — `Event.shortName`, falling back to `name` for events that
   * don't have one yet. */
  backShort: string;
  backLong: string;
}

export function cardsForBooks(bookIds: string[]): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const id of bookIds) {
    const content = booksContent[id];
    if (!content) continue;
    const eventMap = new Map(content.events.map((e) => [e.id, e]));
    for (const deck of content.decks) {
      for (const eventId of deck.cardEventIds) {
        const e = eventMap.get(eventId);
        if (!e) continue;
        cards.push({ front: formatCitation(e.citation), backShort: e.shortName ?? e.name, backLong: e.summary });
      }
    }
  }
  return cards;
}
