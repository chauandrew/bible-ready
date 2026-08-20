"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { bookRegistry, dataForBooks, formatCitation } from "@/lib/content";
import { selectDailyQuestion, isCorrect, type Answer } from "@/lib/quiz";
import { todayDateStr, getCachedResult, cacheResult, type QotdResult } from "@/lib/dailyQuestion";
import { getDeviceId } from "@/lib/deviceId";
import { McQuestion, SequenceQuestion, MatchQuestion, FreeResponseQuestion } from "./QuestionTypes";

export default function DailyQuestionRunner() {
  const sources = useMemo(() => dataForBooks(bookRegistry.map((b) => b.id)), []);
  // Date.now() is impure, so the start time is captured in an effect (mount),
  // not during render.
  const startRef = useRef<number | null>(null);
  const deviceIdRef = useRef("");

  // dateStr/localStorage aren't available during static-export SSR — hydrate
  // once on mount, same pattern as PracticePage's loadProgress().
  const [dateStr, setDateStr] = useState<string | null>(null);
  const [cached, setCached] = useState<QotdResult | null>(null);
  const [result, setResult] = useState<QotdResult | null>(null);

  useEffect(() => {
    // One-time hydration from localStorage/clock (unavailable during static-export
    // SSR) — not a state update in response to a render, so the cascading render
    // this rule guards against doesn't apply here.
    const d = todayDateStr();
    startRef.current = Date.now();
    deviceIdRef.current = getDeviceId();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateStr(d);
    setCached(getCachedResult(d));
  }, []);

  const item = useMemo(() => (dateStr ? selectDailyQuestion(sources, dateStr) : null), [dateStr, sources]);

  function handleAnswer(a: Answer) {
    if (!item || !dateStr) return;
    const r: QotdResult = { correct: isCorrect(item, a), timeMs: Date.now() - (startRef.current ?? Date.now()) };
    cacheResult(dateStr, r);
    setResult(r);
  }

  if (!dateStr || !item) return null;

  const shown = result ?? cached;

  if (shown) {
    return (
      <main className="container">
        <p className="eyebrow" style={{ marginTop: "1rem" }}>Question of the Day</p>
        <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)" }}>
          {shown.correct ? "Correct!" : "Not quite"}
        </h1>
        <div className="note" style={{ borderColor: shown.correct ? "var(--success-border)" : "var(--danger-border)" }}>
          Your time: {(shown.timeMs / 1000).toFixed(1)}s
        </div>
        <p className="citation" style={{ marginTop: "0.5rem" }}>{formatCitation(item.citation)}</p>
        <p style={{ color: "var(--text-secondary)", marginTop: "1rem" }}>
          Come back tomorrow for a new question.
        </p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: "1rem", display: "inline-block" }}>
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="container">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>Question of the Day</p>
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)" }}>
        Today&apos;s question
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
        Answer as fast as you can — one question a day.
      </p>
      <div className="card">
        {"options" in item ? (
          <McQuestion key={item.id} item={item} mode="quiz" onAnswer={handleAnswer} />
        ) : item.type === "sequence" ? (
          <SequenceQuestion key={item.id} item={item} mode="quiz" onAnswer={handleAnswer} />
        ) : item.type === "match" ? (
          <MatchQuestion key={item.id} item={item} mode="quiz" onAnswer={handleAnswer} />
        ) : (
          <FreeResponseQuestion key={item.id} item={item} mode="quiz" onAnswer={handleAnswer} />
        )}
      </div>
    </main>
  );
}
