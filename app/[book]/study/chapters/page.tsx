import Link from "next/link";
import { notFound } from "next/navigation";
import { arcsForBook, chaptersForArcInBook, wiredBookIds, bookMeta } from "@/lib/content";

export function generateStaticParams() {
  return wiredBookIds.map((book) => ({ book }));
}

export default async function ChaptersIndex({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const arcs = arcsForBook(bookId);

  return (
    <main className="container-wide">
      <h1 className="page-title" style={{ margin: "1rem 0 1.25rem" }}>Chapters</h1>
      {arcs.map((arc) => {
        const chapters = chaptersForArcInBook(bookId, arc.id);
        return (
        <details key={arc.id} className="arc-disclosure" open>
          <summary>
            <span className="section-title" style={{ margin: 0 }}>{arc.name}</span>
            <span className="citation">
              {book.coverageDepth === "selection"
                ? `${chapters.length} chapter${chapters.length === 1 ? "" : "s"}`
                : `${arc.startChapter}–${arc.endChapter}`}
            </span>
          </summary>
          <div className="chapter-card-grid">
            {chapters.map((c) => (
              <Link key={c.id} href={`/${bookId}/study/chapters/${c.number}`} className="card chapter-card">
                <div className="chapter-card-head">
                  <span className="chapter-card-number">{book.name} {c.number}</span>
                  <span className="chapter-card-view">View details →</span>
                </div>
                <div className="chapter-card-title">{c.title}</div>
                <p className="chapter-card-summary">{c.summary}</p>
              </Link>
            ))}
          </div>
        </details>
        );
      })}
    </main>
  );
}
