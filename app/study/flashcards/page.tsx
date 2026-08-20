import Link from "next/link";
import { decks } from "@/lib/content";

export default function FlashcardsIndex() {
  return (
    <main className="container-wide">
      <h1 className="page-title" style={{ margin: "1rem 0 1.25rem" }}>Flashcards</h1>
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
