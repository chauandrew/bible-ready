import Link from "next/link";
import { genesis, arcs } from "@/lib/content";

const modules = [
  { href: "/quiz/all", label: "Quick quiz — all of Genesis", desc: "10 mixed questions, ends with your score." },
  { href: "/diagnostic", label: "Diagnostic exam", desc: "A fixed 25-question exam, then a breakdown of where to focus." },
  { href: "/study/chapters", label: "Study chapters", desc: "Browse all 50 chapters, grouped by narrative arc." },
  { href: "/study/people", label: "People", desc: "Key figures and the family line." },
  { href: "/study/flashcards", label: "Flashcards", desc: "Flip through key events, one card at a time." },
  { href: "/progress", label: "Your progress", desc: "Scores, weak spots, and questions to practice again." },
  { href: "/print/all", label: "Print a worksheet", desc: "A paper handout with an answer key, for a room with no phones." },
];

export default function GenesisHome() {
  return (
    <main className="container">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        <Link href="/" style={{ color: "inherit" }}>Bible Ready</Link>
      </p>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "0.35rem" }}>{genesis.name}</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        Learn the storyline of {genesis.name} — what happens, where, and to whom.
      </p>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {modules.map((m) => (
          <Link key={m.href} href={m.href} className="card" style={{ display: "block", textDecoration: "none" }}>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {m.desc}
            </div>
          </Link>
        ))}
      </div>

      <p className="eyebrow" style={{ marginTop: "2rem" }}>Narrative arcs</p>
      <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
        {arcs.map((a) => (
          <Link key={a.id} href={`/study/arcs/${a.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", textDecoration: "none" }}>
            <span>{a.name}</span>
            <span className="citation">{a.startChapter}–{a.endChapter}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
