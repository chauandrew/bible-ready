import Link from "next/link";

const available = [
  { href: "/genesis", name: "Genesis", desc: "From creation to Joseph, 50 chapters with quizzes and flashcards." },
  { href: "/exodus", name: "Exodus", desc: "From slavery in Egypt to the crossing of the Red Sea, 14 chapters." },
];

const comingSoon = [
  { name: "Psalms", desc: "The most well-known psalms." },
];

const combine = [
  { href: "/quiz/bible", label: "Quiz", desc: "Choose your books and sections, then take a mixed quiz." },
  { href: "/study/flashcards/bible", label: "Flashcards", desc: "One shuffled deck from the books you pick." },
];

export default function Home() {
  return (
    <main className="container-wide">
      <div className="hero hero-grid">
        <div>
          <h1 className="page-title hero-title">Get Bible Ready</h1>
          <p className="page-lede">Study the Bible with quizzes, flashcards, and book overviews</p>
        </div>
        <Link href="/qotd" className="card qotd-cta">
          <div className="qotd-cta-eyebrow">Question of the day</div>
          <div className="qotd-cta-title" style={{ fontWeight: 700 }}>Play today&apos;s question</div>
          <div className="qotd-cta-desc" style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            One shared question every day. Answer fast.
          </div>
        </Link>
      </div>

      <h2 className="section-title" style={{ marginTop: "2.25rem" }}>Study one book</h2>
      <p className="page-lede" style={{ marginBottom: "1rem" }}>
        Chapters, people, quizzes, and flashcards for one book.
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
        Mix questions or flashcards from any set of books you pick.
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
