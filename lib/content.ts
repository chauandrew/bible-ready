import bookJson from "@/content/genesis/book.json";
import arcsJson from "@/content/genesis/arcs.json";
import chaptersJson from "@/content/genesis/chapters.json";
import peopleJson from "@/content/genesis/people.json";
import eventsJson from "@/content/genesis/events.json";
import quotesJson from "@/content/genesis/quotes.json";
import questionsJson from "@/content/genesis/questions.json";
import decksJson from "@/content/genesis/decks.json";
import {
  BookContentSchema,
  type Arc,
  type AuthoredQuestion,
  type Book,
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
 */
const raw = BookContentSchema.parse({
  book: bookJson,
  arcs: arcsJson,
  chapters: chaptersJson,
  people: peopleJson,
  events: eventsJson,
  quotes: quotesJson,
  questions: questionsJson,
  decks: decksJson,
});

export const genesis: Book = raw.book;
export const arcs: Arc[] = raw.arcs;
export const chapters: Chapter[] = raw.chapters;
export const people: Person[] = raw.people;
export const events: Event[] = raw.events;
export const quotes: Quote[] = raw.quotes;
export const authoredQuestions: AuthoredQuestion[] = raw.questions;
export const decks: Deck[] = raw.decks;

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

export function formatCitation(c: { book: string; chapter: number; verses?: string }): string {
  const bookName = c.book === "genesis" ? "Genesis" : c.book;
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
  const arcChapters = chaptersForArc(arc.id);
  const chapterNumbers = new Set(arcChapters.map((c) => c.number));
  const arcEvents = events.filter((e) => chapterNumbers.has(e.chapter));
  const arcQuotes = quotes.filter((q) => chapterNumbers.has(q.chapter));
  const arcQuestions = authoredQuestions.filter((q) => chapterNumbers.has(q.citation.chapter));
  return {
    data: { book: genesis, arcs: [arc], chapters: arcChapters, people, events: arcEvents, quotes: arcQuotes },
    questions: arcQuestions,
  };
}
