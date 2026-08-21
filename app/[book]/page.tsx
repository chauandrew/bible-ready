import Link from "next/link";
import { notFound } from "next/navigation";
import { bookMeta, wiredBookIds } from "@/lib/content";

export function generateStaticParams() {
  return wiredBookIds.map((book) => ({ book }));
}

export default async function BookHome({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();

  const studyTools = [
    { href: `/${bookId}/study/flashcards`, label: "Flashcards", desc: "Flip through key events, one card at a time." },
    { href: `/${bookId}/study/people`, label: "Key People", desc: "Key figures and the family line." },
    { href: `/${bookId}/study/chapters`, label: `${book.name} Overview`, desc: `Browse all ${book.chapterCount} chapters, grouped by narrative arc.` },
  ];

  const reviewTools = [
    { href: `/${bookId}/quiz`, label: "Quiz", desc: "Pick your questions and sections, then see your score and where to focus." },
    { href: `/${bookId}/print/all`, label: "Worksheet", desc: "A paper handout with an answer key, for a room with no phones." },
  ];

  return (
    <main className="container-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <p className="eyebrow" style={{ marginTop: "1rem" }}>
          <Link href="/" style={{ color: "inherit" }}>Bible Ready</Link>
        </p>
        <Link href="/progress" style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Your progress →
        </Link>
      </div>
      <h1 className="page-title">{book.name}</h1>
      <p className="page-lede">
        Learn what happens in {book.name}, where, and to whom.
      </p>

      <h2 className="section-title">Study tools</h2>
      <div className="grid-cards">
        {studyTools.map((m) => (
          <Link key={m.href} href={m.href} className="card">
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {m.desc}
            </div>
          </Link>
        ))}
      </div>

      <h2 className="section-title" style={{ marginTop: "2.25rem" }}>Review tools</h2>
      <div className="grid-cards">
        {reviewTools.map((m) => (
          <Link key={m.href} href={m.href} className="card">
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {m.desc}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
