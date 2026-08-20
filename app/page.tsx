import Link from "next/link";

const available = [
  { href: "/genesis", name: "Genesis", desc: "Creation through Joseph — 50 chapters, quizzes, flashcards, and a diagnostic exam." },
  { href: "/exodus", name: "Exodus", desc: "Oppression in Egypt through the crossing of the Red Sea — 14 chapters." },
];

const comingSoon = [
  { name: "Psalms", desc: "A curated set of the most well-known psalms." },
];

const combine = [
  { href: "/quiz/bible", label: "Quiz", desc: "Pick any set of books, get a mixed quiz across all of them." },
  { href: "/diagnostic/bible", label: "Diagnostic exam", desc: "The 25-question diagnostic, drawn from books you select." },
  { href: "/study/flashcards/bible", label: "Flashcards", desc: "One shuffled deck built from the books you select." },
];

export default function Home() {
  return (
    <main className="container-wide">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>Bible Ready</p>
      <h1 className="page-title">Study the Bible</h1>
      <p className="page-lede">
        Study and quiz on the main events and storyline — what happens, where, and to whom.
      </p>

      <h2 className="section-title">Question of the Day</h2>
      <div className="grid-cards" style={{ marginBottom: "0.5rem" }}>
        <Link href="/qotd" className="card">
          <div style={{ fontWeight: 600, color: "var(--text)" }}>Play today&apos;s question</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            One shared question, once a day — answer as fast as you can.
          </div>
        </Link>
      </div>

      <h2 className="section-title" style={{ marginTop: "2.25rem" }}>Study one book</h2>
      <p className="page-lede" style={{ marginBottom: "1rem" }}>
        Chapters, people, quizzes, flashcards, and a diagnostic exam — all for one book.
      </p>
      <div className="grid-cards">
        {available.map((b) => (
          <Link key={b.href} href={b.href} className="card">
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

      <h2 className="section-title" style={{ marginTop: "2.25rem" }}>Study across books</h2>
      <p className="page-lede" style={{ marginBottom: "1rem" }}>
        Mix questions or flashcards from several books at once — the whole Bible, or any set you pick.
      </p>
      <div className="grid-cards">
        {combine.map((c) => (
          <Link key={c.href} href={c.href} className="card">
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{c.label}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {c.desc}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
