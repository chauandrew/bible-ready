import Link from "next/link";
import { notFound } from "next/navigation";
import { arcs, chaptersForArc } from "@/lib/content";

export function generateStaticParams() {
  return arcs.map((a) => ({ id: a.id }));
}

export default async function ArcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const arc = arcs.find((a) => a.id === id);
  if (!arc) notFound();
  const chapters = chaptersForArc(arc.id);

  return (
    <main className="container">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>Genesis {arc.startChapter}–{arc.endChapter}</p>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{arc.name}</h1>
      <p style={{ marginBottom: "1rem" }}>{arc.summary}</p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <Link href={`/quiz/${arc.id}`} className="btn btn-primary">Quiz this arc</Link>
        <Link href={`/print/${arc.id}`} className="btn">Print worksheet</Link>
      </div>

      <div style={{ display: "grid", gap: "0.5rem" }}>
        {chapters.map((c) => (
          <Link key={c.id} href={`/study/chapters/${c.number}`} className="card" style={{ display: "block", textDecoration: "none" }}>
            <div style={{ fontWeight: 600 }}>Genesis {c.number} — {c.title}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
