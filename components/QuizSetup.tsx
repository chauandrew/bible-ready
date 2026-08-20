"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthoredQuestion } from "@/content/schema";
import type { BookData } from "@/lib/generate";
import { selectQuiz } from "@/lib/quiz";
import QuizRunner from "./QuizRunner";

export default function QuizSetup({
  moduleId,
  moduleLabel,
  data,
  questions,
  defaultCount = 10,
  backHref,
  backLabel,
}: {
  moduleId: string;
  moduleLabel: string;
  data: BookData;
  questions: AuthoredQuestion[];
  defaultCount?: number;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const seedFromUrl = params.get("s");
  const modeFromUrl = params.get("mode") === "quiz" ? "quiz" : params.get("mode") === "study" ? "study" : null;

  const [mode, setMode] = useState<"study" | "quiz">(modeFromUrl ?? "study");
  const [started, setStarted] = useState(!!seedFromUrl);
  const [seed] = useState(() => seedFromUrl ?? Math.random().toString(36).slice(2, 10));

  if (started) {
    const items = selectQuiz(data, questions, { seedStr: `${moduleId}:${seed}`, targetCount: defaultCount });
    return <QuizRunner items={items} mode={mode} moduleId={moduleId} backHref={backHref} backLabel={backLabel} />;
  }

  return (
    <main className="container">
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)", marginTop: "1rem" }}>{moduleLabel}</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>{defaultCount} questions.</p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Mode</p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn" style={mode === "study" ? { borderColor: "var(--accent)" } : undefined} onClick={() => setMode("study")}>
            Study — reveal after each question
          </button>
          <button type="button" className="btn" style={mode === "quiz" ? { borderColor: "var(--accent)" } : undefined} onClick={() => setMode("quiz")}>
            Quiz — review at the end
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          router.replace(`?s=${seed}&mode=${mode}`);
          setStarted(true);
        }}
      >
        Start
      </button>
    </main>
  );
}
