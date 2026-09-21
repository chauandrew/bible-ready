import Link from "next/link";
import { available } from "../page";

// Canonical Bible divisions, in order, covering all 66 books (+ misc) so this
// list never needs to change as more books get wired — only `available` in
// app/page.tsx grows. Ids match the slugs in CONTENT_PLAN.md's coverage table.
const sections: { heading: string; ids: string[] }[] = [
  { heading: "Law", ids: ["genesis", "exodus", "leviticus", "numbers", "deuteronomy"] },
  {
    heading: "Historical",
    ids: [
      "joshua", "judges", "ruth", "1-samuel", "2-samuel", "1-kings", "2-kings",
      "1-chronicles", "2-chronicles", "ezra", "nehemiah", "esther",
    ],
  },
  { heading: "Wisdom & Poetry", ids: ["job", "psalms", "proverbs", "ecclesiastes", "song-of-solomon"] },
  { heading: "Major Prophets", ids: ["isaiah", "jeremiah", "lamentations", "ezekiel", "daniel"] },
  {
    heading: "Minor Prophets",
    ids: [
      "hosea", "joel", "amos", "obadiah", "jonah", "micah", "nahum",
      "habakkuk", "zephaniah", "haggai", "zechariah", "malachi",
    ],
  },
  { heading: "Gospels & Acts", ids: ["matthew", "mark", "luke", "john", "acts"] },
  {
    heading: "Pauline Epistles",
    ids: [
      "romans", "1-corinthians", "2-corinthians", "galatians", "ephesians",
      "philippians", "colossians", "1-thessalonians", "2-thessalonians",
      "1-timothy", "2-timothy", "titus", "philemon",
    ],
  },
  {
    heading: "General Epistles",
    ids: ["hebrews", "james", "1-peter", "2-peter", "1-john", "2-john", "3-john", "jude"],
  },
  { heading: "Revelation", ids: ["revelation"] },
  { heading: "Miscellaneous", ids: ["misc"] },
];

export default function AllModules() {
  return (
    <main className="container-wide">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        <Link href="/" style={{ color: "inherit" }}>Bible Ready</Link>
      </p>
      <h1 className="page-title" style={{ margin: "0 0 1.25rem" }}>All Modules</h1>
      {sections.map(({ heading, ids }) => {
        const books = available.filter((b) => ids.includes(b.href.slice(1)));
        if (books.length === 0) return null;
        return (
          <details key={heading} className="arc-disclosure" open>
            <summary>
              <span className="section-title" style={{ margin: 0 }}>{heading}</span>
              <span className="citation">{books.length} {books.length === 1 ? "book" : "books"}</span>
            </summary>
            <div className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 360px))" }}>
              {books.map((b) => (
                <Link key={b.href} href={b.href} className="card">
                  <div style={{ fontWeight: 600, color: "var(--text)" }}>{b.name}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {b.desc}
                  </div>
                </Link>
              ))}
            </div>
          </details>
        );
      })}
    </main>
  );
}
