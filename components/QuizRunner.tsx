"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { QuizItem, Answer } from "@/lib/quiz";
import { scoreQuiz, gapReport, isCorrect, pointsFor, maxPointsFor, pointsColor, categorizeByBook, correctAnswerText, userAnswerText } from "@/lib/quiz";
import { recordSession, clearMissed } from "@/lib/progress";
import { formatCitation } from "@/lib/content";
import { McQuestion, SequenceQuestion, MatchQuestion, FreeResponseQuestion, ChapterGuessQuestion } from "./QuestionTypes";

type Mode = "study" | "quiz";

/** Whole numbers display plain; fractional (partial-credit) scores get one
 * decimal place, since points are always a multiple of 0.5 (see pointsFor). */
function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// -----------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------

export default function QuizRunner({
  items,
  mode,
  moduleId,
  categorize = categorizeByBook,
  resultsExtra,
  backHref,
  backLabel,
  singleBookId,
}: {
  items: QuizItem[];
  mode: Mode;
  moduleId: string;
  /** Groups items for the "where to focus" report and the progress page's
   * category stats — defaults to grouping by book (right for a quiz spanning
   * several books). A single-book quiz passes an arc-based categorizer
   * instead, since "which book" isn't a useful distinction within one book. */
  categorize?: (item: QuizItem) => string;
  /** Rendered above the review list on the results screen — used for the category
   * ("where to focus") breakdown. */
  resultsExtra?: (report: ReturnType<typeof gapReport>) => ReactNode;
  /** Where the "back to..." buttons go, and what they say — every screen this quiz
   * can be reached from renders a different book (or none), so there's no sane default. */
  backHref: string;
  backLabel: string;
  /** Set when every item in this quiz is from one book — passed through to
   * ChapterGuessQuestion so it can drop the redundant book input/prompt text. */
  singleBookId?: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [done, setDone] = useState(false);

  const item = items[index];

  function handleAnswer(a: Answer) {
    // Keyed by itemId rather than appended, so answering the same question again
    // after using Back replaces the old answer instead of duplicating it.
    const next = [...answers.filter((x) => x.itemId !== a.itemId), a];
    setAnswers(next);
    goNext(next);
  }

  function goNext(currentAnswers: Answer[]) {
    if (index + 1 < items.length) {
      setIndex(index + 1);
    } else {
      finish(currentAnswers);
    }
  }

  function finish(finalAnswers: Answer[]) {
    const score = scoreQuiz(items, finalAnswers);
    const report = gapReport(items, finalAnswers, categorize);
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
  const report = useMemo(() => (done ? gapReport(items, answers, categorize) : null), [done, items, answers, categorize]);

  if (done && score) {
    return (
      <main className="container">
        <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)", marginTop: "1rem" }}>
          Score: {formatPoints(score.correct)}/{formatPoints(score.total)}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>{score.percent}% correct</p>

        {resultsExtra && report && resultsExtra(report)}

        {mode === "quiz" && (
          <>
            <p className="eyebrow">Review</p>
            <div style={{ display: "grid", gap: "0.6rem", margin: "0.5rem 0 1.5rem" }}>
              {items.map((it) => {
                const a = answers.find((x) => x.itemId === it.id);
                const points = a ? pointsFor(it, a) : 0;
                const max = maxPointsFor(it);
                const correctText = correctAnswerText(it);
                const borderColor = pointsColor(points, max);
                const label =
                  points >= max
                    ? "Correct: "
                    : points > 0
                    ? `Partial credit (${formatPoints(points)}/${formatPoints(max)}): `
                    : "Answer: ";
                return (
                  <div key={it.id} className="card">
                    <div style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>{it.prompt}</div>
                    {points < max && (
                      <div className="note" style={{ borderColor: "var(--danger-border)", marginBottom: "0.35rem" }}>
                        Your answer: {a ? userAnswerText(it, a) : "(no answer)"}
                      </div>
                    )}
                    <div className="note" style={{ borderColor }}>
                      {label}
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

        <button type="button" className="btn btn-primary" onClick={() => router.push(backHref)}>{backLabel}</button>
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
        <button type="button" className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => router.push(backHref)}>
          {backLabel}
        </button>
      </main>
    );
  }
  if (!item) return null;

  // Revisiting an already-answered question via Previous pre-fills it from
  // the recorded answer (each question type restores and stays fully
  // editable) rather than presenting a blank question — changing it and
  // resubmitting replaces the old answer, same as answering the first time.
  const existingAnswer = answers.find((x) => x.itemId === item.id);

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn" onClick={() => router.push(backHref)}>
            {backLabel}
          </button>
          <button type="button" className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            ← Previous
          </button>
        </div>
        <div className="eyebrow">
          {index + 1} / {items.length}
        </div>
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
          <McQuestion
            key={item.id}
            item={item}
            mode={mode}
            onAnswer={handleAnswer}
            initialAnswer={existingAnswer?.kind === "mc" ? existingAnswer : undefined}
          />
        ) : item.type === "sequence" ? (
          <SequenceQuestion
            key={item.id}
            item={item}
            mode={mode}
            onAnswer={handleAnswer}
            initialAnswer={existingAnswer?.kind === "sequence" ? existingAnswer : undefined}
          />
        ) : item.type === "match" ? (
          <MatchQuestion
            key={item.id}
            item={item}
            mode={mode}
            onAnswer={handleAnswer}
            initialAnswer={existingAnswer?.kind === "match" ? existingAnswer : undefined}
          />
        ) : item.type === "chapter-guess" ? (
          <ChapterGuessQuestion
            key={item.id}
            item={item}
            mode={mode}
            onAnswer={handleAnswer}
            initialAnswer={existingAnswer?.kind === "chapter-guess" ? existingAnswer : undefined}
            singleBookId={singleBookId}
          />
        ) : (
          <FreeResponseQuestion
            key={item.id}
            item={item}
            mode={mode}
            onAnswer={handleAnswer}
            initialAnswer={existingAnswer?.kind === "free-response" ? existingAnswer : undefined}
          />
        )}
      </div>
    </main>
  );
}
