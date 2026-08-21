import { notFound } from "next/navigation";
import { decksForBook, deckInBook, cardsForDeck, cardsForBooks, wiredBookIds, bookMeta } from "@/lib/content";
import { hashSeed, mulberry32, shuffle } from "@/lib/rng";
import FlashcardDeck from "@/components/FlashcardDeck";

/** Sentinel deck id for "every deck in this book, merged" — not a real authored deck. */
const ENTIRE_BOOK_DECK_ID = "entire-book";

export function generateStaticParams() {
  return wiredBookIds.flatMap((book) => [
    { book, deck: ENTIRE_BOOK_DECK_ID },
    ...decksForBook(book).map((d) => ({ book, deck: d.id })),
  ]);
}

export default async function DeckPage({ params }: { params: Promise<{ book: string; deck: string }> }) {
  const { book: bookId, deck: deckId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();

  if (deckId === ENTIRE_BOOK_DECK_ID) {
    const cards = shuffle(cardsForBooks([bookId]), mulberry32(hashSeed(`entire-book:${bookId}`)));
    return <FlashcardDeck title={`All of ${book.name}`} cards={cards} />;
  }

  const deck = deckInBook(bookId, deckId);
  if (!deck) notFound();
  return <FlashcardDeck title={deck.name} cards={cardsForDeck(bookId, deckId)} />;
}
