import Link from "next/link";
import { notFound } from "next/navigation";
import { people, personById, formatCitation } from "@/lib/content";

export function generateStaticParams() {
  return people.map((p) => ({ id: p.id }));
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = personById.get(id);
  if (!person) notFound();

  return (
    <main className="container">
      <h1 style={{ fontSize: "1.4rem", margin: "1rem 0 0.25rem" }}>{person.name}</h1>
      <p className="citation" style={{ marginBottom: "0.75rem" }}>
        First appears {formatCitation(person.firstAppearance)}
      </p>
      <p style={{ marginBottom: "1rem" }}>{person.summary}</p>

      {person.relations.length > 0 && (
        <>
          <p className="eyebrow">Family</p>
          <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.5rem" }}>
            {person.relations.map((r) => {
              const other = personById.get(r.personId);
              return other ? (
                <Link key={r.personId} href={`/study/people/${r.personId}`} className="card" style={{ display: "flex", justifyContent: "space-between", textDecoration: "none" }}>
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
