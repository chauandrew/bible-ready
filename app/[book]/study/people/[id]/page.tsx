import Link from "next/link";
import { notFound } from "next/navigation";
import { peopleForBook, personInBook, formatCitation, wiredBookIds, bookMeta } from "@/lib/content";

export function generateStaticParams() {
  return wiredBookIds.flatMap((book) => peopleForBook(book).map((p) => ({ book, id: p.id })));
}

export default async function PersonPage({ params }: { params: Promise<{ book: string; id: string }> }) {
  const { book: bookId, id } = await params;
  if (!bookMeta(bookId) || !wiredBookIds.includes(bookId)) notFound();
  const person = personInBook(bookId, id);
  if (!person) notFound();

  return (
    <main className="container">
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.85rem)", marginBottom: "0.25rem" }}>{person.name}</h1>
      <p className="citation" style={{ marginBottom: "0.75rem" }}>
        First appears {formatCitation(person.firstAppearance)}
      </p>
      <p style={{ marginBottom: "1rem" }}>{person.summary}</p>

      {person.relations.length > 0 && (
        <>
          <p className="eyebrow">Family</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.4rem", marginTop: "0.5rem" }}>
            {person.relations.map((r) => {
              const other = personInBook(bookId, r.personId);
              return other ? (
                <Link key={r.personId} href={`/${bookId}/study/people/${r.personId}`} className="card" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{other.name}</span>
                  <span className="citation">{r.relation}</span>
                </Link>
              ) : null;
            })}
          </div>
        </>
      )}
    </main>
  );
}
