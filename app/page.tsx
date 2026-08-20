import Link from "next/link";

const available = [
  { href: "/genesis", name: "Genesis", desc: "Creation through Joseph — 50 chapters, quizzes, flashcards, and a diagnostic exam." },
];

const comingSoon = [
  { name: "Exodus", desc: "Oppression in Egypt through the crossing of the Red Sea." },
  { name: "Psalms", desc: "A curated set of the most well-known psalms." },
];

export default function Home() {
  return (
    <main className="container">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>Bible Ready</p>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "0.35rem" }}>Pick a book</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        Study and quiz on the main events and storyline — what happens, where, and to whom.
      </p>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {available.map((b) => (
          <Link key={b.href} href={b.href} className="card" style={{ display: "block", textDecoration: "none" }}>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{b.name}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {b.desc}
            </div>
          </Link>
        ))}

        {comingSoon.map((b) => (
          <div key={b.name} className="card" style={{ opacity: 0.6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontWeight: 600 }}>{b.name}</span>
              <span className="badge">Coming soon</span>
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {b.desc}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
