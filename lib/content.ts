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
} from "@/content/schema";
import type { BookData } from "./generate";

/**
 * The only module that touches content JSON directly. Everything else reads
 * through the lookups below. If a database is ever needed, this file is the
 * one thing that changes.
 */
const genesisContent: BookContent = BookContentSchema.parse({
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

/** Every loaded book's full content bundle, keyed by book id. */
const booksContent: Record<string, BookContent> = {
  [genesisContent.book.id]: genesisContent,
  [exodusContent.book.id]: exodusContent,
  [psalmsContent.book.id]: psalmsContent,
};

/** Book metadata for every loaded book — used by the "which books do you want to
 * include" pickers in the whole-Bible / multi-book quiz, diagnostic, and flashcard modes. */
export const bookRegistry: Book[] = Object.values(booksContent).map((c) => c.book);

/**
 * Books with a full section of their own (home page, chapters, people, quiz,
 * diagnostic, flashcards, print) — see `app/[book]/*`. Psalms' content is fully
 * authored and already feeds the whole-Bible / multi-book modes above, but as a
 * "selection" book (a curated, non-contiguous set of psalms — see DESIGN.md) it
 * needs page treatment a "narrative" book doesn't, so it isn't wired up as its
 * own section yet.
 */
export const wiredBookIds: string[] = ["genesis", "exodus"];

export function bookMeta(bookId: string): Book | undefined {
  return booksContent[bookId]?.book;
}

// ---------------------------------------------------------------------------
// Per-book lookups. Each book's ids (person, event, deck...) are only ever
// looked up within that same book — see the note on `cardsForBooks` below for
// why these deliberately don't get flattened into one global map.
// ---------------------------------------------------------------------------

export function arcsForBook(bookId: string): Arc[] {
  return booksContent[bookId]?.arcs ?? [];
}

export function arcInBook(bookId: string, arcId: string): Arc | undefined {
  return arcsForBook(bookId).find((a) => a.id === arcId);
}

export function chaptersForBook(bookId: string): Chapter[] {
  return booksContent[bookId]?.chapters ?? [];
}

export function chapterInBook(bookId: string, number: number): Chapter | undefined {
  return chaptersForBook(bookId).find((c) => c.number === number);
}

/** Membership is by chapter.arcId, not the arc's startChapter/endChapter range — the
 * range is display metadata only, so this also works for non-contiguous "selection"
 * books (e.g. a curated set of famous psalms) where a range can't express membership. */
export function chaptersForArcInBook(bookId: string, arcId: string): Chapter[] {
  return chaptersForBook(bookId)
    .filter((c) => c.arcId === arcId)
    .sort((a, b) => a.number - b.number);
}

export function eventsForChapterInBook(bookId: string, chapterNumber: number): Event[] {
  const events = booksContent[bookId]?.events ?? [];
  return events.filter((e) => e.chapter === chapterNumber).sort((a, b) => a.order - b.order);
}

export function peopleForBook(bookId: string): Person[] {
  return booksContent[bookId]?.people ?? [];
}

export function personInBook(bookId: string, personId: string): Person | undefined {
  return peopleForBook(bookId).find((p) => p.id === personId);
}

export function personsForEventInBook(bookId: string, event: Event): Person[] {
  const people = peopleForBook(bookId);
  return event.peopleIds.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
}

export function decksForBook(bookId: string): Deck[] {
  return booksContent[bookId]?.decks ?? [];
}

export function deckInBook(bookId: string, deckId: string): Deck | undefined {
  return decksForBook(bookId).find((d) => d.id === deckId);
}

/** Book id -> how it reads in a citation. `citationName` exists for books whose
 * citation form differs from their name ("Psalm 23:1", not "Psalms 23:1"). */
const citationNames = new Map<string, string>(
  Object.values(booksContent).map((c) => [c.book.id, c.book.citationName ?? c.book.name])
);

export function formatCitation(c: { book: string; chapter: number; verses?: string }): string {
  const bookName = citationNames.get(c.book) ?? c.book;
  return c.verses ? `${bookName} ${c.chapter}:${c.verses}` : `${bookName} ${c.chapter}`;
}

/** Chapter summary by (book, number) — used for the free-response model answer
 * (QuizRunner, PrintSheet). Keyed by both, not just the number, since chapter
 * numbers repeat across books (Genesis 3 and Exodus 3 are different chapters). */
const chapterByBookAndNumber = new Map<string, Chapter>();
for (const content of Object.values(booksContent)) {
  for (const c of content.chapters) chapterByBookAndNumber.set(`${c.book}:${c.number}`, c);
}
export function chapterSummaryFor(book: string, number: number): string | undefined {
  return chapterByBookAndNumber.get(`${book}:${number}`)?.summary;
}

// ---------------------------------------------------------------------------
// Quiz module resolution, scoped to one book: "all" or a specific arc id.
// ---------------------------------------------------------------------------

export function quizModuleIdsForBook(bookId: string): string[] {
  return ["all", ...arcsForBook(bookId).map((a) => a.id)];
}

export function dataForModuleInBook(
  bookId: string,
  moduleId: string
): { data: BookData; questions: AuthoredQuestion[] } | null {
  const content = booksContent[bookId];
  if (!content) return null;
  if (moduleId === "all") {
    return {
      data: { book: content.book, arcs: content.arcs, chapters: content.chapters, people: content.people, events: content.events, quotes: content.quotes },
      questions: content.questions,
    };
  }
  const arc = content.arcs.find((a) => a.id === moduleId);
  if (!arc) return null;
  // Pass the whole book and scope by chapter rather than handing the generator a
  // pre-filtered slice: an arc restricts what gets *asked*, but its distractors
  // still need the book-wide pools (a 2-chapter arc can't supply 3 wrong chapters).
  const chapterNumbers = chaptersForArcInBook(bookId, arc.id).map((c) => c.number);
  return {
    data: { book: content.book, arcs: content.arcs, chapters: content.chapters, people: content.people, events: content.events, quotes: content.quotes, scopeChapters: chapterNumbers },
    questions: content.questions.filter((q) => chapterNumbers.includes(q.citation.chapter)),
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

export interface Flashcard {
  front: string;
  /** A few-word headline — `Event.shortName`, falling back to `name` for events that
   * don't have one yet. */
  backShort: string;
  backLong: string;
}

function cardsForEventIds(bookId: string, eventIds: string[]): Flashcard[] {
  const content = booksContent[bookId];
  if (!content) return [];
  const eventMap = new Map(content.events.map((e) => [e.id, e]));
  return eventIds
    .map((id) => eventMap.get(id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({ front: formatCitation(e.citation), backShort: e.shortName ?? e.name, backLong: e.summary }));
}

/** One deck's cards, in the deck's authored order. */
export function cardsForDeck(bookId: string, deckId: string): Flashcard[] {
  const deck = deckInBook(bookId, deckId);
  return deck ? cardsForEventIds(bookId, deck.cardEventIds) : [];
}

/** Every flashcard from every deck in the requested books, as one merged list — used
 * both for "the whole book, not just one category deck" and for "multiple books at a
 * time". Passing a single book id is how a book's "entire book" deck is built. */
export function cardsForBooks(bookIds: string[]): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const id of bookIds) {
    const content = booksContent[id];
    if (!content) continue;
    for (const deck of content.decks) cards.push(...cardsForEventIds(id, deck.cardEventIds));
  }
  return cards;
}
