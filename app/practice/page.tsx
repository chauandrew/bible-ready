"use client";

import { useEffect, useState } from "react";
import { loadProgress } from "@/lib/progress";
import { bookRegistry, dataForBooks } from "@/lib/content";
import { quizFromIdsMulti } from "@/lib/quiz";
import QuizRunner from "@/components/QuizRunner";

export default function PracticePage() {
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    // One-time hydration from localStorage (unavailable during static-export
    // SSR) — not a state update in response to a render, so the cascading
    // render this rule guards against doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds(loadProgress().missed);
  }, []);

  if (!ids) return null;
  if (ids.length === 0) {
    return (
      <main className="container">
        <h1 className="page-title" style={{ marginTop: "1rem" }}>Practice your misses</h1>
        <p style={{ color: "var(--text-secondary)" }}>Nothing to practice — you have no missed questions saved.</p>
      </main>
    );
  }

  const sources = dataForBooks(bookRegistry.map((b) => b.id));
  const items = quizFromIdsMulti(sources, ids);

  return <QuizRunner items={items} mode="study" moduleId="practice" backHref="/" backLabel="Back to all books" />;
}
