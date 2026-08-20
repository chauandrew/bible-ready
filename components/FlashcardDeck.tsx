"use client";

import { useState } from "react";

export default function FlashcardDeck({ title, cards }: { title: string; cards: { front: string; back: string }[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  if (!card) {
    return (
      <main className="container">
        <h1 style={{ fontSize: "1.4rem", margin: "1rem 0" }}>{title}</h1>
        <p style={{ color: "var(--text-secondary)" }}>This deck has no cards yet.</p>
      </main>
    );
  }

  function next() {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  }
  function prev() {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  }

  return (
    <main className="container">
      <div className="eyebrow" style={{ marginTop: "1rem" }}>{title} · {index + 1}/{cards.length}</div>
      {/* aria-pressed + a live region: flipping swapped the text silently, so a
          screen reader announced nothing when the card turned over. */}
      <button
        type="button"
        className="card"
        onClick={() => setFlipped(!flipped)}
        aria-pressed={flipped}
        aria-label={flipped ? "Card, showing the answer. Activate to flip back." : "Card, showing the reference. Activate to flip."}
        style={{ width: "100%", minHeight: "180px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", margin: "1rem 0", fontSize: "1.1rem", cursor: "pointer" }}
      >
        <span aria-live="polite">{flipped ? card.back : card.front}</span>
      </button>
      <p className="citation" style={{ textAlign: "center", marginBottom: "1rem" }}>Tap the card to flip</p>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button type="button" className="btn" onClick={prev}>← Prev</button>
        <button type="button" className="btn btn-primary" onClick={next}>Next →</button>
      </div>
    </main>
  );
}
