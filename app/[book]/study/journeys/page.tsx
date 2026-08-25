import Link from "next/link";
import { notFound } from "next/navigation";
import { bookMeta, journeysForBook, wiredBookIds } from "@/lib/content";

export function generateStaticParams() {
  return wiredBookIds.map((book) => ({ book }));
}

export default async function JourneysIndex({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const journeys = journeysForBook(bookId);

  return (
    <main className="container-wide">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>{book.name}</p>
      <h1 className="page-title">Story maps</h1>
      <p className="page-lede" style={{ marginBottom: "1.25rem" }}>
        Follow a character arc event by event, with each stop plotted on a map.
      </p>

      {journeys.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No story maps for {book.name} yet.</p>
      ) : (
        <div className="grid-cards">
          {journeys.map((j) => (
            <Link key={j.id} href={`/${bookId}/study/journeys/${j.id}`} className="card">
              <div style={{ fontWeight: 600, color: "var(--text)" }}>{j.name}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                {j.summary}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
