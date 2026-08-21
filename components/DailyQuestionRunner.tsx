"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { bookRegistry, dataForBooks, formatCitation } from "@/lib/content";
import { selectDailyQuestion, isCorrect, correctAnswerText, type Answer } from "@/lib/quiz";
import {
  todayDateStr,
  getCachedResult,
  cacheResult,
  submitDailyAnswer,
  fetchMyResult,
  AlreadyPlayedError,
  type QotdResult,
} from "@/lib/dailyQuestion";
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
  // True while the mount-time "did I already play today" check is in
  // flight, so we don't flash the question before a remote answer (e.g.
  // from a second device/tab) comes back and replaces it.
  const [checking, setChecking] = useState(true);
  const [submitError, setSubmitError] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    // One-time hydration from localStorage/clock (unavailable during static-export
    // SSR) — not a state update in response to a render, so the cascading render
    // this rule guards against doesn't apply here.
    const d = todayDateStr();
    startRef.current = Date.now();
    deviceIdRef.current = getDeviceId();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateStr(d);

    const localCached = getCachedResult(d);
    if (localCached) {
      setCached(localCached);
      setChecking(false);
      return;
    }
    // Local cache says "not played yet" — that could be a fresh device, or
    // a second device/tab, or a partially-cleared cache. fetchMyResult is
    // the authoritative check; if it errors (offline, no env vars) we just
    // fall through to showing the question.
    fetchMyResult(d, deviceIdRef.current)
      .then((remote) => {
        if (remote) {
          cacheResult(d, remote);
          setCached(remote);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const item = useMemo(() => (dateStr ? selectDailyQuestion(sources, dateStr) : null), [dateStr, sources]);

  async function trySubmit(correct: boolean, timeMs: number) {
    if (!dateStr || !item) return;
    setSubmitError(false);
    try {
      const submitted = await submitDailyAnswer({
        playDate: dateStr,
        deviceId: deviceIdRef.current,
        questionId: item.id,
        correct,
        timeMs,
      });
      cacheResult(dateStr, submitted);
      setResult(submitted);
    } catch (err) {
      if (err instanceof AlreadyPlayedError) {
        try {
          const mine = await fetchMyResult(dateStr, deviceIdRef.current);
          if (mine) {
            cacheResult(dateStr, mine);
            setResult(mine);
            return;
          }
        } catch {
          // fetchMyResult also failed — fall through to the retry banner below.
        }
      }
      setSubmitError(true);
    }
  }

  function handleAnswer(a: Answer) {
    if (!item || !dateStr) return;
    const correct = isCorrect(item, a);
    const timeMs = Date.now() - (startRef.current ?? Date.now());
    const local: QotdResult = { correct, timeMs };
    cacheResult(dateStr, local);
    setResult(local);
    void trySubmit(correct, timeMs);
  }

  const shown = result ?? cached;
  const answering = !!dateStr && !!item && !checking && !shown;

  // Ticks while the question is still unanswered so the player can see time
  // passing, not just their final time after submitting.
  useEffect(() => {
    if (!answering) return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - (startRef.current ?? Date.now()));
    }, 100);
    return () => clearInterval(id);
  }, [answering]);

  if (!dateStr || !item || checking) return null;

  if (shown) {
    return (
      <main className="container">
        <p className="eyebrow" style={{ marginTop: "1rem" }}>Question of the Day</p>
        <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)" }}>
          {shown.correct ? "Correct!" : "Not quite"}
        </h1>
        <div className="note" style={{ borderColor: shown.correct ? "var(--success-border)" : "var(--danger-border)" }}>
          Your time: {(shown.timeMs / 1000).toFixed(1)}s
          {!shown.correct && (
            <>
              <br />
              Correct answer: {correctAnswerText(item)}
            </>
          )}
        </div>
        {shown.correct && shown.correctPlayers != null && (
          <p style={{ color: "var(--text-secondary)", marginTop: "0.75rem" }}>
            {shown.correctPlayers > 1
              ? `Faster than ${shown.speedPercentile}% of today's players who got it right.`
              : "You're the first to answer today!"}
          </p>
        )}
        {!shown.correct && shown.accuracyPercent != null && (
          <p style={{ color: "var(--text-secondary)", marginTop: "0.75rem" }}>
            {shown.accuracyPercent}% of today&apos;s players got this right.
          </p>
        )}
        {submitError && (
          <div className="note" style={{ marginTop: "0.75rem", borderColor: "var(--danger-border)" }}>
            Couldn&apos;t reach the server to save your answer.{" "}
            <button type="button" className="btn btn-primary" onClick={() => void trySubmit(shown.correct, shown.timeMs)}>
              Try again
            </button>
          </div>
        )}
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
      <p style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
        One question a day. Answer as fast as you can.
      </p>
      <p className="citation" style={{ marginBottom: "1rem" }}>
        Time: {(elapsedMs / 1000).toFixed(1)}s
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
