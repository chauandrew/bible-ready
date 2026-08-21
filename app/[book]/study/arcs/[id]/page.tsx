import Link from "next/link";
import { notFound } from "next/navigation";
import { arcsForBook, arcInBook, chaptersForArcInBook, wiredBookIds, bookMeta } from "@/lib/content";

export function generateStaticParams() {
  return wiredBookIds.flatMap((book) => arcsForBook(book).map((a) => ({ book, id: a.id })));
}

export default async function ArcPage({ params }: { params: Promise<{ book: string; id: string }> }) {
  const { book: bookId, id } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const arc = arcInBook(bookId, id);
  if (!arc) notFound();
  const chapters = chaptersForArcInBook(bookId, arc.id);

  return (
    <main className="container-wide">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        <Link href={`/${bookId}`}>{book.name}</Link>{" "}
        {book.coverageDepth === "selection"
          ? `${chapters.length} chapter${chapters.length === 1 ? "" : "s"}`
          : `${arc.startChapter}–${arc.endChapter}`}
      </p>
      <h1 className="page-title">{arc.name}</h1>
      <p className="page-lede" style={{ marginBottom: "1.25rem" }}>{arc.summary}</p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem" }}>
        <Link href={`/${bookId}/quiz?arcs=${arc.id}`} className="btn btn-primary">Quiz this arc</Link>
        <Link href={`/${bookId}/print/${arc.id}`} className="btn">Print worksheet</Link>
      </div>

      <div className="grid-cards">
        {chapters.map((c) => (
          <Link key={c.id} href={`/${bookId}/study/chapters/${c.number}`} className="card">
            <div style={{ fontWeight: 600 }}>{book.name} {c.number}: {c.title}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
