import Link from "next/link";
import { decks } from "@/lib/content";

export default function FlashcardsIndex() {
  return (
    <main className="container">
      <h1 style={{ fontSize: "1.4rem", margin: "1rem 0" }}>Flashcards</h1>
      {decks.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No decks yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {decks.map((d) => (
            <Link key={d.id} href={`/study/flashcards/${d.id}`} className="card" style={{ display: "block", textDecoration: "none" }}>
              {d.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
