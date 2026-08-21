"use client";

import { useState } from "react";
import { bookRegistry, cardsForBooks } from "@/lib/content";
import { mulberry32, shuffle } from "@/lib/rng";
import BookPicker from "./BookPicker";
import FlashcardDeck from "./FlashcardDeck";

export default function MultiFlashcardSetup() {
  const [selected, setSelected] = useState<Set<string>>(new Set(bookRegistry.map((b) => b.id)));
  const [started, setStarted] = useState(false);
  const [shuffleSeed] = useState(() => Date.now());

  if (started) {
    const chosen = bookRegistry.filter((b) => selected.has(b.id));
    const cards = shuffle(cardsForBooks(chosen.map((b) => b.id)), mulberry32(shuffleSeed));
    const title = chosen.length === bookRegistry.length ? "Whole Bible" : chosen.map((b) => b.name).join(" + ");
    return <FlashcardDeck title={title} cards={cards} />;
  }

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: "1rem" }}>Flashcards across books</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
        Every card from the books you select, shuffled into one deck.
      </p>

      <BookPicker books={bookRegistry} selected={selected} onChange={setSelected} />

      <button type="button" className="btn btn-primary" disabled={selected.size === 0} onClick={() => setStarted(true)}>
        Study
      </button>
    </main>
  );
}
