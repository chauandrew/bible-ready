import Link from "next/link";
import { notFound } from "next/navigation";
import { arcsForBook, bookMeta, wiredBookIds } from "@/lib/content";

export function generateStaticParams() {
  return wiredBookIds.map((book) => ({ book }));
}

export default async function BookHome({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const arcs = arcsForBook(bookId);

  const modules = [
    { href: `/${bookId}/quiz/all`, label: `Quick quiz — all of ${book.name}`, desc: "10 mixed questions, ends with your score." },
    { href: `/${bookId}/diagnostic`, label: "Diagnostic exam", desc: "A fixed 25-question exam, then a breakdown of where to focus." },
    { href: `/${bookId}/study/chapters`, label: "Study chapters", desc: `Browse all ${book.chapterCount} chapters, grouped by narrative arc.` },
    { href: `/${bookId}/study/people`, label: "People", desc: "Key figures and the family line." },
    { href: `/${bookId}/study/flashcards`, label: "Flashcards", desc: "Flip through key events, one card at a time." },
    { href: "/progress", label: "Your progress", desc: "Scores, weak spots, and questions to practice again." },
    { href: `/${bookId}/print/all`, label: "Print a worksheet", desc: "A paper handout with an answer key, for a room with no phones." },
  ];

  return (
    <main className="container-wide">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        <Link href="/" style={{ color: "inherit" }}>Bible Ready</Link>
      </p>
      <h1 className="page-title">{book.name}</h1>
      <p className="page-lede">
        Learn the storyline of {book.name} — what happens, where, and to whom.
      </p>

      <div className="grid-cards">
        {modules.map((m) => (
          <Link key={m.href} href={m.href} className="card">
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {m.desc}
            </div>
          </Link>
        ))}
      </div>

      <p className="eyebrow" style={{ marginTop: "2.25rem" }}>Narrative arcs</p>
      <div className="grid-cards" style={{ marginTop: "0.6rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {arcs.map((a) => (
          <Link key={a.id} href={`/${bookId}/study/arcs/${a.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{a.name}</span>
            <span className="citation">{a.startChapter}–{a.endChapter}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
