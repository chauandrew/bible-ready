"use client";

import { useState } from "react";
import type { QuizItem, Answer } from "@/lib/quiz";
import { pointsFor, pointsColor, correctAnswerText } from "@/lib/quiz";
import { gradeFreeResponse } from "@/lib/grade";
import { formatCitation, chapterSummaryFor, bookMeta, matchBookName } from "@/lib/content";

type Mode = "study" | "quiz";

// -----------------------------------------------------------------------
// Per-type question renderers. Each is remounted fresh per item via a
// `key={item.id}` from the parent, so they can hold uncontrolled local state.
// -----------------------------------------------------------------------

export function McQuestion({
  item,
  mode,
  onAnswer,
  initialAnswer,
}: {
  item: Extract<QuizItem, { options: string[] }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
  /** The player's existing answer, when revisiting a question already
   * answered this quiz — pre-fills the pick so Quiz mode shows what was
   * chosen instead of a blank question, while remaining fully editable. */
  initialAnswer?: Extract<Answer, { kind: "mc" }>;
}) {
  const [selected, setSelected] = useState<number | null>(initialAnswer?.selectedIndex ?? null);

  function choose(i: number) {
    // Study mode locks in the pick to reveal correct/incorrect color and
    // hold it until "Next" — Quiz mode never locks, since re-picking (e.g.
    // after Previous) should just replace the answer and re-advance.
    if (mode === "study" && selected !== null) return;
    setSelected(i);
    if (mode === "quiz") {
      onAnswer({ itemId: item.id, kind: "mc", selectedIndex: i });
    }
  }

  return (
    <div>
      <p style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>{item.prompt}</p>
      {item.options.map((opt, i) => {
        let cls = "option";
        if (mode === "study" && selected !== null) {
          if (i === item.correctIndex) cls += " option-correct";
          else if (i === selected) cls += " option-incorrect";
        }
        // Study-mode feedback used to be carried by colour alone, which says
        // nothing to a screen reader or to a red-green colourblind reader.
        const marker = mode === "study" && selected !== null
          ? i === item.correctIndex ? "Correct answer: " : i === selected ? "Your answer, incorrect: " : ""
          : "";
        return (
          <button
            key={opt}
            type="button"
            className={cls}
            disabled={mode === "study" && selected !== null}
            aria-pressed={mode === "quiz" ? selected === i : undefined}
            style={mode === "quiz" && selected === i ? { borderColor: "var(--accent)" } : undefined}
            onClick={() => choose(i)}
          >
            {marker && <span className="sr-only">{marker}</span>}
            {marker && <span aria-hidden="true">{i === item.correctIndex ? "✓ " : "✗ "}</span>}
            {opt}
          </button>
        );
      })}
      {mode === "study" && selected !== null && (
        <>
          <p className="citation" style={{ marginTop: "0.5rem" }}>{formatCitation(item.citation)}</p>
          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onAnswer({ itemId: item.id, kind: "mc", selectedIndex: selected })}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SequenceQuestion({
  item,
  mode,
  onAnswer,
  initialAnswer,
}: {
  item: Extract<QuizItem, { type: "sequence" }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
  /** Pre-fills the placed order when revisiting an already-answered
   * question — still fully editable via the existing tap-to-undo flow. */
  initialAnswer?: Extract<Answer, { kind: "sequence" }>;
}) {
  const [chosen, setChosen] = useState<string[]>(initialAnswer?.order ?? []);
  const [checked, setChecked] = useState(false);
  const remaining = item.displayItems.filter((x) => !chosen.includes(x));
  const allPlaced = remaining.length === 0;

  function submit() {
    if (mode === "study") setChecked(true);
    else onAnswer({ itemId: item.id, kind: "sequence", order: chosen });
  }

  return (
    <div>
      <p style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>{item.prompt}</p>
      {!checked && chosen.length > 0 && (
        <p className="citation" style={{ marginBottom: "0.4rem" }}>Tap a placed event to undo it.</p>
      )}
      {chosen.length > 0 && (
        <ol style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", marginBottom: "0.75rem", paddingLeft: "1.2rem" }}>
          {chosen.map((c, i) => (
            <li key={c} style={checked ? { color: c === item.correctOrder[i] ? "var(--success-text)" : "var(--danger-text)" } : { marginBottom: "0.35rem" }}>
              {checked ? (
                <>
                  <span aria-hidden="true">{c === item.correctOrder[i] ? "✓ " : "✗ "}</span>
                  <span className="sr-only">{c === item.correctOrder[i] ? "correct position: " : "wrong position: "}</span>
                  {c}
                </>
              ) : (
                <button type="button" className="option" style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem" }} onClick={() => setChosen(chosen.filter((x) => x !== c))}>
                  {c}
                  <span className="sr-only">. Tap to remove.</span>
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {!checked && remaining.map((r) => (
        <button key={r} type="button" className="option" onClick={() => setChosen([...chosen, r])}>
          {r}
        </button>
      ))}
      {allPlaced && !checked && (
        <button type="button" className="btn btn-primary" style={{ marginTop: "0.5rem" }} onClick={submit}>
          {mode === "study" ? "Check order" : "Submit order"}
        </button>
      )}
      {checked && (
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: "0.5rem" }}
          onClick={() => onAnswer({ itemId: item.id, kind: "sequence", order: chosen })}
        >
          Next
        </button>
      )}
    </div>
  );
}

export function MatchQuestion({
  item,
  mode,
  onAnswer,
  initialAnswer,
}: {
  item: Extract<QuizItem, { type: "match" }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
  /** Pre-fills the paired-up state when revisiting an already-answered
   * question — still fully editable (tap a paired left to undo it). */
  initialAnswer?: Extract<Answer, { kind: "match" }>;
}) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<{ left: string; right: string }[]>(initialAnswer?.pairs ?? []);
  const [checked, setChecked] = useState(false);
  const correctSet = new Set(item.correctPairs.map((p) => `${p.left}::${p.right}`));
  const allPaired = pairs.length === item.lefts.length;

  function pickRight(right: string) {
    if (!selectedLeft || checked) return;
    setPairs([...pairs, { left: selectedLeft, right }]);
    setSelectedLeft(null);
  }

  function submit() {
    if (mode === "study") setChecked(true);
    else onAnswer({ itemId: item.id, kind: "match", pairs });
  }

  return (
    <div>
      <p style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>{item.prompt}</p>
      {!checked && pairs.length > 0 && (
        <p className="citation" style={{ marginBottom: "0.4rem" }}>Tap a matched left card to undo it.</p>
      )}
      {checked ? (
        <ul style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", listStyle: "none", padding: 0, marginBottom: "0.75rem" }}>
          {pairs.map((p) => {
            const ok = correctSet.has(`${p.left}::${p.right}`);
            return (
              <li key={p.left} style={{ color: ok ? "var(--success-text)" : "var(--danger-text)" }}>
                <span aria-hidden="true">{ok ? "✓ " : "✗ "}</span>
                <span className="sr-only">{ok ? "correct: " : "incorrect: "}</span>
                {p.left} → {p.right}
              </li>
            );
          })}
        </ul>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <div>
            {item.lefts.map((l) => {
              const pair = pairs.find((p) => p.left === l);
              return (
                <button
                  key={l}
                  type="button"
                  className="option"
                  aria-pressed={selectedLeft === l}
                  style={
                    pair
                      ? { borderColor: "var(--success-border)", color: "var(--success-text)" }
                      : selectedLeft === l
                      ? { borderColor: "var(--accent)" }
                      : undefined
                  }
                  onClick={() => (pair ? setPairs(pairs.filter((p) => p.left !== l)) : setSelectedLeft(l))}
                >
                  {pair ? (
                    <>
                      <span className="sr-only">matched, tap to undo: </span>
                      {l} <span aria-hidden="true">→</span> {pair.right}
                    </>
                  ) : (
                    l
                  )}
                </button>
              );
            })}
          </div>
          <div>
            {item.rights.map((r) => {
              const pair = pairs.find((p) => p.right === r);
              return (
                <button
                  key={r}
                  type="button"
                  className="option"
                  disabled={!!pair || !selectedLeft}
                  style={pair ? { borderColor: "var(--success-border)", color: "var(--success-text)" } : undefined}
                  onClick={() => pickRight(r)}
                >
                  {pair ? (
                    <>
                      <span className="sr-only">matched: </span>
                      {pair.left} <span aria-hidden="true">→</span> {r}
                    </>
                  ) : (
                    r
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {allPaired && !checked && (
        <button type="button" className="btn btn-primary" style={{ marginTop: "0.5rem" }} onClick={submit}>
          {mode === "study" ? "Check matches" : "Submit matches"}
        </button>
      )}
      {checked && (
        <button type="button" className="btn btn-primary" style={{ marginTop: "0.5rem" }} onClick={() => onAnswer({ itemId: item.id, kind: "match", pairs })}>
          Next
        </button>
      )}
    </div>
  );
}

export function FreeResponseQuestion({
  item,
  mode,
  onAnswer,
  initialAnswer,
}: {
  item: Extract<QuizItem, { type: "free-response" }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
  /** Pre-fills the typed answer when revisiting an already-answered question. */
  initialAnswer?: Extract<Answer, { kind: "free-response" }>;
}) {
  const [text, setText] = useState(initialAnswer?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof gradeFreeResponse> | null>(null);

  function submit() {
    if (!text.trim()) {
      setError("Enter an answer before submitting.");
      return;
    }
    if (mode === "quiz") {
      onAnswer({ itemId: item.id, kind: "free-response", text });
      return;
    }
    setResult(gradeFreeResponse({ terms: item.terms, minTerms: item.minTerms }, text));
  }

  const modelAnswer = chapterSummaryFor(item.citation.book, item.chapterNumber);

  return (
    <div>
      <p style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>{item.prompt}</p>
      {!result && (
        <>
          <textarea
            className={error ? "input input-error" : "input"}
            rows={3}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            placeholder={`Type what happens in this ${bookMeta(item.citation.book)?.chapterLabel ?? "chapter"}…`}
            aria-label={item.prompt}
            aria-invalid={!!error}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div style={{ marginTop: "0.75rem" }}>
            <button type="button" className="btn btn-primary" onClick={submit}>
              Submit
            </button>
          </div>
        </>
      )}
      {result && (
        <>
          <div className="note" style={{ borderColor: result.correct ? "var(--success-border)" : "var(--danger-border)" }}>
            <span className="sr-only">{result.correct ? "Correct: " : "Not quite: "}</span>
            <span aria-hidden="true">{result.correct ? "✓ " : "✗ "}</span>
            {result.correct ? "Good. You covered the main idea. " : "Not quite. Here's what happens: "}
            {modelAnswer}
          </div>
          <p className="citation" style={{ marginTop: "0.5rem" }}>{formatCitation(item.citation)}</p>
          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onAnswer({ itemId: item.id, kind: "free-response", text })}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ChapterGuessQuestion({
  item,
  mode,
  onAnswer,
  initialAnswer,
}: {
  item: Extract<QuizItem, { type: "chapter-guess" }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
  /** Pre-fills book/chapter when revisiting an already-answered question.
   * Only the resolved book id is stored (not the raw text originally typed),
   * so this shows the book's canonical name rather than any typo/phrasing
   * the player used the first time — still fully editable either way. */
  initialAnswer?: Extract<Answer, { kind: "chapter-guess" }>;
}) {
  const [bookText, setBookText] = useState(() => (initialAnswer?.book ? bookMeta(initialAnswer.book)?.name ?? "" : ""));
  const [chapterText, setChapterText] = useState(() => (initialAnswer ? String(initialAnswer.chapter) : ""));
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);

  function submit() {
    const chapter = Number(chapterText);
    if (!bookText.trim() || !chapterText.trim() || !Number.isInteger(chapter) || chapter < 1) {
      setError("Enter a book and a chapter number.");
      return;
    }
    // A typo'd or made-up book name just fails to match — matchBookName
    // returns undefined, which falls through to an ordinary wrong answer
    // rather than throwing.
    const answer: Answer = { itemId: item.id, kind: "chapter-guess", book: matchBookName(bookText)?.id ?? "", chapter };
    if (mode === "quiz") {
      onAnswer(answer);
      return;
    }
    setPoints(pointsFor(item, answer));
  }

  return (
    <div>
      <p style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>{item.prompt}</p>
      {points === null && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ flex: "1 1 160px" }}
              type="text"
              value={bookText}
              onChange={(e) => {
                setBookText(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Book"
              aria-label="Book"
            />
            <input
              className="input"
              style={{ flex: "1 1 120px" }}
              type="number"
              min={1}
              inputMode="numeric"
              value={chapterText}
              onChange={(e) => {
                setChapterText(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Chapter"
              aria-label="Chapter number"
            />
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div style={{ marginTop: "0.75rem" }}>
            <button type="button" className="btn btn-primary" onClick={submit}>
              Submit
            </button>
          </div>
        </>
      )}
      {points !== null && (
        <>
          <div className="note" style={{ borderColor: pointsColor(points) }}>
            <span className="sr-only">{points === 1 ? "Correct: " : points > 0 ? "Close, half credit: " : "Not quite: "}</span>
            <span aria-hidden="true">{points === 1 ? "✓ " : points > 0 ? "≈ " : "✗ "}</span>
            {points === 1 ? "Correct. " : points > 0 ? "Close — one chapter off, half credit. " : "Not quite. "}
            {correctAnswerText(item)}
          </div>
          <p className="citation" style={{ marginTop: "0.5rem" }}>{formatCitation(item.citation)}</p>
          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onAnswer({
                  itemId: item.id,
                  kind: "chapter-guess",
                  book: matchBookName(bookText)?.id ?? "",
                  chapter: Number(chapterText),
                })
              }
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
