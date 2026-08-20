import Link from "next/link";
import { arcs, chaptersForArc } from "@/lib/content";

export default function ChaptersIndex() {
  return (
    <main className="container">
      <h1 style={{ fontSize: "1.4rem", margin: "1rem 0" }}>Chapters</h1>
      {arcs.map((arc) => (
        <section key={arc.id} style={{ marginBottom: "1.5rem" }}>
          <Link href={`/study/arcs/${arc.id}`} style={{ textDecoration: "none" }}>
            <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>{arc.name}</h2>
          </Link>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: "0.4rem" }}>
            {chaptersForArc(arc.id).map((c) => (
              <Link
                key={c.id}
                href={`/study/chapters/${c.number}`}
                className="card"
                style={{ textAlign: "center", padding: "0.6rem 0.3rem", textDecoration: "none", fontFamily: "var(--font-sans)" }}
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
