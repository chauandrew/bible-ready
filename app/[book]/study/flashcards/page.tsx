import Link from "next/link";
import { notFound } from "next/navigation";
import { decksForBook, wiredBookIds, bookMeta } from "@/lib/content";

export function generateStaticParams() {
  return wiredBookIds.map((book) => ({ book }));
}

export default async function FlashcardsIndex({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const decks = decksForBook(bookId);

  return (
    <main className="container-wide">
      <h1 className="page-title" style={{ margin: "1rem 0 1.25rem" }}>Flashcards</h1>
      <div className="grid-cards" style={{ marginBottom: "1.5rem" }}>
        <Link href={`/${bookId}/study/flashcards/entire-book`} className="card">
          <div style={{ fontWeight: 600, color: "var(--text)" }}>Entire book</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Every card from every deck below, shuffled into one {book.name} deck.
          </div>
        </Link>
      </div>
      {decks.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No decks yet.</p>
      ) : (
        <div className="grid-cards">
          {decks.map((d) => (
            <Link key={d.id} href={`/${bookId}/study/flashcards/${d.id}`} className="card">
              {d.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
