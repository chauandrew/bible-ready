"use client";

import { useEffect, useState } from "react";

export default function FlashcardDeck({
  title,
  cards,
}: {
  title: string;
  cards: { front: string; backShort: string; backLong: string }[];
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  function next() {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  }
  function prev() {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  }

  // Hotkeys: space/enter flips, arrow keys move — so studying doesn't require
  // reaching for the mouse between every card.
  useEffect(() => {
    if (cards.length === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  if (!card) {
    return (
      <main className="container">
        <h1 className="page-title" style={{ marginTop: "1rem" }}>{title}</h1>
        <p style={{ color: "var(--text-secondary)" }}>This deck has no cards yet.</p>
      </main>
    );
  }

  return (
    <main className="container" style={{ maxWidth: "560px" }}>
      <div className="eyebrow" style={{ marginTop: "1rem" }}>{title} · {index + 1}/{cards.length}</div>
      {/* aria-pressed + a live region: flipping swapped the text silently, so a
          screen reader announced nothing when the card turned over. */}
      <button
        type="button"
        className="card"
        onClick={() => setFlipped(!flipped)}
        aria-pressed={flipped}
        aria-label={flipped ? "Card, showing the answer. Activate to flip back." : "Card, showing the reference. Activate to flip."}
        style={{ width: "100%", minHeight: "clamp(180px, 28vw, 260px)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", margin: "1rem 0", padding: "1.5rem", cursor: "pointer", transition: "border-color 0.15s ease" }}
      >
        <span aria-live="polite">
          {flipped ? (
            <>
              <div style={{ fontFamily: "var(--font-voice)", fontWeight: 700, fontSize: "1.3rem" }}>{card.backShort}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "0.6rem" }}>
                {card.backLong}
              </div>
            </>
          ) : (
            <div style={{ fontSize: "1.15rem" }}>{card.front}</div>
          )}
        </span>
      </button>
      <p className="citation" style={{ textAlign: "center", marginBottom: "1rem" }}>
        Tap the card to flip · Space to flip · ← → to move
      </p>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button type="button" className="btn" onClick={prev}>← Prev</button>
        <button type="button" className="btn btn-primary" onClick={next}>Next →</button>
      </div>
    </main>
  );
}
