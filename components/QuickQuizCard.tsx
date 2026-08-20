"use client";

import { useRouter } from "next/navigation";

/** Generates a fresh seed per click and jumps straight into a running quiz —
 * QuizSetup already auto-starts when `?s=` is present, so this skips its
 * "10 questions. Start" screen entirely rather than duplicating that logic. */
export default function QuickQuizCard({ bookId }: { bookId: string }) {
  const router = useRouter();

  function start() {
    const seed = Math.random().toString(36).slice(2, 10);
    router.push(`/${bookId}/quiz/all?s=${seed}`);
  }

  return (
    <button type="button" className="card" onClick={start}>
      <div style={{ fontWeight: 600, color: "var(--text)" }}>Quick Quiz</div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
        10 mixed questions, ends with your score.
      </div>
    </button>
  );
}
