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
import johnBookJson from "@/content/john/book.json";
import johnArcsJson from "@/content/john/arcs.json";
import johnChaptersJson from "@/content/john/chapters.json";
import johnPeopleJson from "@/content/john/people.json";
import johnEventsJson from "@/content/john/events.json";
import johnQuotesJson from "@/content/john/quotes.json";
import johnQuestionsJson from "@/content/john/questions.json";
import johnDecksJson from "@/content/john/decks.json";
import miscBookJson from "@/content/misc/book.json";
import miscArcsJson from "@/content/misc/arcs.json";
import miscChaptersJson from "@/content/misc/chapters.json";
import miscPeopleJson from "@/content/misc/people.json";
import miscEventsJson from "@/content/misc/events.json";
import miscQuotesJson from "@/content/misc/quotes.json";
import miscQuestionsJson from "@/content/misc/questions.json";
import miscDecksJson from "@/content/misc/decks.json";
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
import { normalizeWords, wordMatches } from "./grade";

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

const johnContent: BookContent = BookContentSchema.parse({
  book: johnBookJson,
  arcs: johnArcsJson,
  chapters: johnChaptersJson,
  people: johnPeopleJson,
  events: johnEventsJson,
  quotes: johnQuotesJson,
  questions: johnQuestionsJson,
  decks: johnDecksJson,
});

const miscContent: BookContent = BookContentSchema.parse({
  book: miscBookJson,
  arcs: miscArcsJson,
  chapters: miscChaptersJson,
  people: miscPeopleJson,
  events: miscEventsJson,
  quotes: miscQuotesJson,
  questions: miscQuestionsJson,
  decks: miscDecksJson,
});

/** Every loaded book's full content bundle, keyed by book id. */
const booksContent: Record<string, BookContent> = {
  [genesisContent.book.id]: genesisContent,
  [exodusContent.book.id]: exodusContent,
  [psalmsContent.book.id]: psalmsContent,
  [johnContent.book.id]: johnContent,
  [miscContent.book.id]: miscContent,
};

/** Book metadata for every loaded book — used by the "which books do you want to
 * include" pickers in the whole-Bible / multi-book quiz and flashcard modes. */
export const bookRegistry: Book[] = Object.values(booksContent).map((c) => c.book);

/**
 * Books with a full section of their own (home page, chapters, people, quiz,
 * flashcards, print) — see `app/[book]/*`. Psalms is a "selection" book (a
 * curated, non-contiguous set of psalms — see DESIGN.md): its pages handle
 * thematic, overlapping arcs and index-based (not chapter.number +/- 1)
 * chapter navigation instead of the "narrative" book assumptions.
 */
export const wiredBookIds: string[] = ["genesis", "exodus", "psalms", "john", "misc"];

export function bookMeta(bookId: string): Book | undefined {
  return booksContent[bookId]?.book;
}

/** A name's leading number, if any — "1" for "1 timothy", null for "genesis".
 * Numbered books always come in complete pairs (1/2 Timothy, 1/2 Peter...),
 * and the number is the *only* thing distinguishing them, so it must match
 * exactly: "1 timothy" and "2 timothy" are one edit apart by plain string
 * distance, which would otherwise let wordMatches wave the digit through as
 * a "typo" and silently credit the wrong book of the pair. */
export function leadingNumber(s: string): string | null {
  return s.match(/^\d+/)?.[0] ?? null;
}

/** Resolve free-typed book text ("2 timothy", "gensis") to a book, for the
 * chapter-guess free-response question — case-insensitive, and typo-tolerant
 * via the same fuzzy word match free-response grading uses (see lib/grade.ts).
 * Returns undefined for no match rather than throwing, since a guess is just
 * as likely to be wrong as a typo. */
export function matchBookName(input: string): Book | undefined {
  const needle = normalizeWords(input).join(" ");
  if (!needle) return undefined;
  let fuzzyMatch: Book | undefined;
  for (const book of bookRegistry) {
    for (const name of [book.name, book.citationName].filter((n): n is string => !!n)) {
      const haystack = normalizeWords(name).join(" ");
      if (haystack === needle) return book;
      if (!fuzzyMatch && leadingNumber(needle) === leadingNumber(haystack) && wordMatches(needle, haystack)) {
        fuzzyMatch = book;
      }
    }
  }
  return fuzzyMatch;
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
// Print-worksheet module resolution, scoped to one book: "all" or a specific
// arc id (the Quiz picker uses dataForArcsInBook below instead, since it needs
// an arbitrary subset of arcs rather than one-arc-or-all).
// ---------------------------------------------------------------------------

export function printModuleIdsForBook(bookId: string): string[] {
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

/** Scope a book's data/questions to a set of arcs (by id), unioning their chapters —
 * the multi-select generalization of dataForModuleInBook's single-arc case, for the
 * Quiz setup's "sections to cover" picker. Passing all (or none) of the book's arc
 * ids is unscoped, same as the whole book. */
export function dataForArcsInBook(bookId: string, arcIds: string[]): { data: BookData; questions: AuthoredQuestion[] } | null {
  const content = booksContent[bookId];
  if (!content) return null;
  const allArcIds = content.arcs.map((a) => a.id);
  const scoped = arcIds.length > 0 && arcIds.length < allArcIds.length;
  if (!scoped) {
    return {
      data: { book: content.book, arcs: content.arcs, chapters: content.chapters, people: content.people, events: content.events, quotes: content.quotes },
      questions: content.questions,
    };
  }
  const chapterNumbers = content.arcs
    .filter((a) => arcIds.includes(a.id))
    .flatMap((a) => chaptersForArcInBook(bookId, a.id).map((c) => c.number));
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
