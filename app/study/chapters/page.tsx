import Link from "next/link";
import { arcs, chaptersForArc } from "@/lib/content";

export default function ChaptersIndex() {
  return (
    <main className="container-wide">
      <h1 className="page-title" style={{ margin: "1rem 0 1.25rem" }}>Chapters</h1>
      {arcs.map((arc) => (
        <section key={arc.id} style={{ marginBottom: "1.75rem" }}>
          <Link href={`/study/arcs/${arc.id}`} style={{ textDecoration: "none" }}>
            <h2 className="section-title">{arc.name}</h2>
          </Link>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 84px))", gap: "0.5rem" }}>
            {chaptersForArc(arc.id).map((c) => (
              <Link
                key={c.id}
                href={`/study/chapters/${c.number}`}
                className="card"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "44px", padding: "0.4rem", fontFamily: "var(--font-sans)" }}
              >
                {c.number}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
