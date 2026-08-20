"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { QuizItem, Answer } from "@/lib/quiz";
import { scoreQuiz, gapReport, isCorrect, categoryOf } from "@/lib/quiz";
import { gradeFreeResponse } from "@/lib/grade";
import { recordSession, clearMissed } from "@/lib/progress";
import { formatCitation, chapterByNumber } from "@/lib/content";

type Mode = "study" | "quiz";

// -----------------------------------------------------------------------
// Per-type question renderers. Each is remounted fresh per item via a
// `key={item.id}` from the parent, so they can hold uncontrolled local state.
// -----------------------------------------------------------------------

function McQuestion({
  item,
  mode,
  onAnswer,
}: {
  item: Extract<QuizItem, { options: string[] }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  function choose(i: number) {
    if (selected !== null) return;
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
          <button key={opt} type="button" className={cls} disabled={selected !== null} onClick={() => choose(i)}>
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

function SequenceQuestion({
  item,
  mode,
  onAnswer,
}: {
  item: Extract<QuizItem, { type: "sequence" }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
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
      {chosen.length > 0 && (
        <ol style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", marginBottom: "0.75rem", paddingLeft: "1.2rem" }}>
          {chosen.map((c, i) => (
            <li key={c} style={checked ? { color: c === item.correctOrder[i] ? "var(--success-text)" : "var(--danger-text)" } : undefined}>
              {checked && <span aria-hidden="true">{c === item.correctOrder[i] ? "✓ " : "✗ "}</span>}
              {checked && <span className="sr-only">{c === item.correctOrder[i] ? "correct position: " : "wrong position: "}</span>}
              {c}
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

function MatchQuestion({
  item,
  mode,
  onAnswer,
}: {
  item: Extract<QuizItem, { type: "match" }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
}) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<{ left: string; right: string }[]>([]);
  const [checked, setChecked] = useState(false);
  const pairedLefts = new Set(pairs.map((p) => p.left));
  const pairedRights = new Set(pairs.map((p) => p.right));
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
            {item.lefts.map((l) => (
              <button
                key={l}
                type="button"
                className="option"
                disabled={pairedLefts.has(l)}
                aria-pressed={selectedLeft === l}
                style={selectedLeft === l ? { borderColor: "var(--accent)" } : undefined}
                onClick={() => setSelectedLeft(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <div>
            {item.rights.map((r) => (
              <button key={r} type="button" className="option" disabled={pairedRights.has(r) || !selectedLeft} onClick={() => pickRight(r)}>
                {r}
              </button>
            ))}
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

function FreeResponseQuestion({
  item,
  mode,
  onAnswer,
}: {
  item: Extract<QuizItem, { type: "free-response" }>;
  mode: Mode;
  onAnswer: (a: Answer) => void;
}) {
  const [text, setText] = useState("");
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
    setResult(gradeFreeResponse({ keywordGroups: item.keywordGroups, minGroups: item.minGroups }, text));
  }

  const modelAnswer = chapterByNumber.get(item.chapterNumber)?.summary;

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
            placeholder="Type what happens in this chapter…"
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
            {result.correct ? "Good — you covered the main idea. " : "Not quite — here's what happens: "}
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

// -----------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------

export default function QuizRunner({
  items,
  mode,
  moduleId,
  resultsExtra,
}: {
  items: QuizItem[];
  mode: Mode;
  moduleId: string;
  /** Rendered above the review list on the results screen — used by the diagnostic's gap report. */
  resultsExtra?: (report: ReturnType<typeof gapReport>) => ReactNode;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [done, setDone] = useState(false);

  const item = items[index];

  function handleAnswer(a: Answer) {
    const next = [...answers, a];
    setAnswers(next);
    if (index + 1 < items.length) {
      setIndex(index + 1);
    } else {
      finish(next);
    }
  }

  function finish(finalAnswers: Answer[]) {
    const score = scoreQuiz(items, finalAnswers);
    const report = gapReport(items, finalAnswers);
    const categoryDelta: Record<string, { right: number; wrong: number }> = {};
    for (const [cat, r] of Object.entries(report)) categoryDelta[cat] = { right: r.right, wrong: r.wrong };
    recordSession(moduleId, score, score.missedIds, categoryDelta);
    for (const a of finalAnswers) {
      const it = items.find((i) => i.id === a.itemId);
      if (it && isCorrect(it, a)) clearMissed(it.id);
    }
    setDone(true);
  }

  const score = useMemo(() => (done ? scoreQuiz(items, answers) : null), [done, items, answers]);
  const report = useMemo(() => (done ? gapReport(items, answers) : null), [done, items, answers]);

  if (done && score) {
    return (
      <main className="container">
        <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)", marginTop: "1rem" }}>Score: {score.correct}/{score.total}</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>{score.percent}% correct</p>

        {resultsExtra && report && resultsExtra(report)}

        {mode === "quiz" && (
          <>
            <p className="eyebrow">Review</p>
            <div style={{ display: "grid", gap: "0.6rem", margin: "0.5rem 0 1.5rem" }}>
              {items.map((it) => {
                const a = answers.find((x) => x.itemId === it.id);
                const correct = a ? isCorrect(it, a) : false;
                const correctText =
                  "correctIndex" in it
                    ? it.options[it.correctIndex]
                    : "correctOrder" in it
                      ? it.correctOrder.join(" → ")
                      : "correctPairs" in it
                        ? it.correctPairs.map((p) => `${p.left} → ${p.right}`).join(", ")
                        : (chapterByNumber.get(it.chapterNumber)?.summary ?? "");
                return (
                  <div key={it.id} className="card">
                    <div style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>{it.prompt}</div>
                    <div className="note" style={{ borderColor: correct ? "var(--success-border)" : "var(--danger-border)" }}>
                      {correct ? "Correct — " : "Answer — "}
                      {correctText}
                      {"explanation" in it && it.explanation ? ` (${it.explanation})` : ""}
                    </div>
                    <p className="citation" style={{ marginTop: "0.35rem" }}>{formatCitation(it.citation)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button type="button" className="btn btn-primary" onClick={() => router.push("/genesis")}>Back to Genesis</button>
      </main>
    );
  }

  // An empty quiz used to render a blank page — reachable from /practice once
  // the saved missed-question ids no longer match any current content.
  if (items.length === 0) {
    return (
      <main className="container">
        <h1 className="page-title" style={{ marginTop: "1rem" }}>Nothing to ask</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          There are no questions available here right now.
        </p>
        <button type="button" className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => router.push("/genesis")}>
          Back to Genesis
        </button>
      </main>
    );
  }
  if (!item) return null;

  return (
    <main className="container">
      <div className="eyebrow" style={{ marginTop: "1rem" }}>
        {index + 1} / {items.length} · {categoryOf(item)}
      </div>
      <div
        className="progress-track"
        style={{ margin: "0.5rem 0 1.25rem" }}
        role="progressbar"
        aria-valuenow={index}
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-label={`Question ${index + 1} of ${items.length}`}
      >
        <div className="progress-fill" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      <div className="card">
        {"options" in item ? (
          <McQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        ) : item.type === "sequence" ? (
          <SequenceQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        ) : item.type === "match" ? (
          <MatchQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        ) : (
          <FreeResponseQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        )}
      </div>
    </main>
  );
}
