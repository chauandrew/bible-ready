import Link from "next/link";

// Canonical Bible order (Genesis, Exodus, ..., 1/2 Samuel, ..., Psalms, ...,
// John, ...), misc last since it has no real position. Insert new books in
// their canonical spot, same convention as lib/content.ts's wiredBookIds.
// `featured` picks the 6 shown on the home page; everything ships to
// /modules regardless.
export const available = [
  { href: "/genesis", name: "Genesis", desc: "From creation to Joseph, 50 chapters with quizzes and flashcards.", featured: true },
  { href: "/exodus", name: "Exodus", desc: "From slavery in Egypt to the crossing of the Red Sea, 14 chapters.", featured: false },
  { href: "/1-samuel", name: "1 Samuel", desc: "Israel's first king rises and falls, and a shepherd named David is anointed to replace him, 31 chapters.", featured: true },
  { href: "/2-samuel", name: "2 Samuel", desc: "David's rise to the throne, his worst sin, and the family rebellion that follows, 24 chapters.", featured: true },
  { href: "/psalms", name: "Psalms", desc: "19 of the most well-known psalms, grouped by theme.", featured: true },
  { href: "/john", name: "John", desc: "The Word made flesh through the empty tomb, 21 chapters with quizzes and flashcards.", featured: true },
  { href: "/galatians", name: "Galatians", desc: "Paul defends justification by faith and confronts Peter, 6 chapters.", featured: true },
  { href: "/misc", name: "Miscellaneous", desc: "The twelve disciples, the twelve tribes of Israel, and putting the Old and New Testament books in order.", featured: true },
];

const comingSoon: { name: string; desc: string }[] = [];

const combine = [
  { href: "/quiz/bible", label: "Quiz", desc: "Choose your books and sections, then take a mixed quiz." },
  { href: "/study/flashcards/bible", label: "Flashcards", desc: "One shuffled deck from the books you pick." },
];

export default function Home() {
  return (
    <main className="container-wide">
      <div className="hero hero-grid">
        <div className="hero-copy">
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem", marginTop: "2.25rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>Modules</h2>
        <Link href="/modules" style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem" }}>View all modules →</Link>
      </div>
      {/* Lower max-track than the shared .grid-cards default so this row settles
          at 3 columns on a desktop-wide screen instead of 4 — auto-fill's
          column count is driven by the max of minmax() when both bounds are
          fixed lengths, not the min. Scoped here, not in the shared class,
          since other .grid-cards pages (chapters, arcs, people) want more
          columns to fit more per row. */}
      <div className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 360px))" }}>
        {available
          .filter((b) => b.featured)
          .map((b) => (
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

      <h2 className="section-title" style={{ marginTop: "2.25rem" }}>Review Tools</h2>
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
