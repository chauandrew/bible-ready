"use client";

import { useEffect, useState } from "react";
import { loadProgress } from "@/lib/progress";
import { dataForModule } from "@/lib/content";
import { quizFromIds } from "@/lib/quiz";
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
        <h1 style={{ fontSize: "1.4rem", margin: "1rem 0" }}>Practice your misses</h1>
        <p style={{ color: "var(--text-secondary)" }}>Nothing to practice — you have no missed questions saved.</p>
      </main>
    );
  }

  const resolved = dataForModule("all")!;
  const items = quizFromIds(resolved.data, resolved.questions, ids);

  return <QuizRunner items={items} mode="study" moduleId="practice" />;
}
