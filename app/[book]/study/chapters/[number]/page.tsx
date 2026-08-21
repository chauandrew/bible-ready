import Link from "next/link";
import { notFound } from "next/navigation";
import {
  chaptersForBook,
  chapterInBook,
  arcInBook,
  eventsForChapterInBook,
  personsForEventInBook,
  formatCitation,
  wiredBookIds,
  bookMeta,
} from "@/lib/content";

export function generateStaticParams() {
  return wiredBookIds.flatMap((book) => chaptersForBook(book).map((c) => ({ book, number: String(c.number) })));
}

export default async function ChapterPage({ params }: { params: Promise<{ book: string; number: string }> }) {
  const { book: bookId, number } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const chapter = chapterInBook(bookId, Number(number));
  if (!chapter) notFound();

  const arc = arcInBook(bookId, chapter.arcId);
  const events = eventsForChapterInBook(bookId, chapter.number);
  // Index-based, not chapter.number +/- 1: a "selection" book's curated chapters
  // (e.g. Psalm 1, 8, 19...) aren't contiguous, so number arithmetic would skip
  // straight past most of them.
  const allChapters = chaptersForBook(bookId).slice().sort((a, b) => a.number - b.number);
  const chapterIndex = allChapters.findIndex((c) => c.number === chapter.number);
  const prev = allChapters[chapterIndex - 1];
  const next = allChapters[chapterIndex + 1];

  return (
    <main className="container" style={{ maxWidth: "760px" }}>
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        <Link href={`/${bookId}`}>{book.name}</Link>
        {arc && <> / <Link href={`/${bookId}/study/arcs/${arc.id}`}>{arc.name}</Link></>}
      </p>
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.85rem)" }}>
        {book.name} {chapter.number}
      </h1>
      <p className="chapter-card-title" style={{ fontSize: "1.1rem" }}>{chapter.title}</p>
      <p style={{ marginBottom: "1.25rem" }}>{chapter.summary}</p>

      {events.length > 0 && (
        <>
          <p className="eyebrow">What happens</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.5rem", margin: "0.5rem 0 1.5rem" }}>
            {events.map((e) => {
              const eventPeople = personsForEventInBook(bookId, e);
              return (
                <div key={e.id} className="card">
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div className="citation" style={{ marginTop: "0.2rem" }}>
                    {e.place ? `${e.place} · ` : ""}
                    {formatCitation(e.citation)}
                    {eventPeople.length > 0 && ` · ${eventPeople.map((p) => p.name).join(", ")}`}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
        {prev ? <Link href={`/${bookId}/study/chapters/${prev.number}`} className="btn">← {book.name} {prev.number}</Link> : <span />}
        {next ? <Link href={`/${bookId}/study/chapters/${next.number}`} className="btn">{book.name} {next.number} →</Link> : <span />}
      </div>
    </main>
  );
}
