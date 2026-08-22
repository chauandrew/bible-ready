"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { QuizItem, Answer } from "@/lib/quiz";
import { scoreQuiz, gapReport, isCorrect, pointsFor, pointsColor, correctAnswerText, userAnswerText } from "@/lib/quiz";
import { recordSession, clearMissed } from "@/lib/progress";
import { formatCitation } from "@/lib/content";
import { McQuestion, SequenceQuestion, MatchQuestion, FreeResponseQuestion, ChapterGuessQuestion } from "./QuestionTypes";

type Mode = "study" | "quiz";

// -----------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------

export default function QuizRunner({
  items,
  mode,
  moduleId,
  resultsExtra,
  backHref,
  backLabel,
}: {
  items: QuizItem[];
  mode: Mode;
  moduleId: string;
  /** Rendered above the review list on the results screen — used for the category
   * ("where to focus") breakdown. */
  resultsExtra?: (report: ReturnType<typeof gapReport>) => ReactNode;
  /** Where the "back to..." buttons go, and what they say — every screen this quiz
   * can be reached from renders a different book (or none), so there's no sane default. */
  backHref: string;
  backLabel: string;
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
                const points = a ? pointsFor(it, a) : 0;
                const correctText = correctAnswerText(it);
                const borderColor = pointsColor(points);
                const label = points === 1 ? "Correct: " : points > 0 ? "Close (half credit): " : "Answer: ";
                return (
                  <div key={it.id} className="card">
                    <div style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>{it.prompt}</div>
                    {points < 1 && (
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

  // Quiz mode commits an answer and auto-advances on a single click, with no
  // confirmation — so revisiting an already-answered question via Previous
  // must not present it as blank and interactive again. Without this, a
  // stray click there silently overwrites the original answer, and the
  // review at the end shows the new one with no sign it ever changed. Study
  // mode is unaffected: retrying a question there is an intended feature.
  const existingAnswer = mode === "quiz" ? answers.find((x) => x.itemId === item.id) : undefined;

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
        {existingAnswer ? (
          <div>
            <p style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>{item.prompt}</p>
            <div className="note">Already answered: {userAnswerText(item, existingAnswer)}</div>
            <div style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn btn-primary" onClick={() => goNext(answers)}>
                {index + 1 < items.length ? "Next" : "See results"}
              </button>
            </div>
          </div>
        ) : "options" in item ? (
          <McQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        ) : item.type === "sequence" ? (
          <SequenceQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        ) : item.type === "match" ? (
          <MatchQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        ) : item.type === "chapter-guess" ? (
          <ChapterGuessQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        ) : (
          <FreeResponseQuestion key={item.id} item={item} mode={mode} onAnswer={handleAnswer} />
        )}
      </div>
    </main>
  );
}
