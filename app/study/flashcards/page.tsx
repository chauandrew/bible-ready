import Link from "next/link";
import { decks } from "@/lib/content";

export default function FlashcardsIndex() {
  return (
    <main className="container-wide">
      <h1 className="page-title" style={{ margin: "1rem 0 1.25rem" }}>Flashcards</h1>
      <div className="grid-cards" style={{ marginBottom: "1.5rem" }}>
        <Link href="/study/flashcards/bible" className="card">
          <div style={{ fontWeight: 600, color: "var(--text)" }}>Combine books</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            The entire book, the whole Bible, or any set of books you pick.
          </div>
        </Link>
      </div>
      {decks.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No decks yet.</p>
      ) : (
        <div className="grid-cards">
          {decks.map((d) => (
            <Link key={d.id} href={`/study/flashcards/${d.id}`} className="card">
              {d.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
