"use client";

import type { AuthoredQuestion } from "@/content/schema";
import type { BookData } from "@/lib/generate";
import { selectQuiz, type QuizItem } from "@/lib/quiz";
import { formatCitation } from "@/lib/content";

const PRINT_SEED = "print-v1";

function answerText(item: QuizItem): string {
  if ("correctIndex" in item) return item.options[item.correctIndex];
  if ("correctOrder" in item) return item.correctOrder.join(" → ");
  return item.correctPairs.map((p) => `${p.left} → ${p.right}`).join("; ");
}

export default function PrintSheet({
  moduleLabel,
  data,
  questions,
  count = 20,
}: {
  moduleLabel: string;
  data: BookData;
  questions: AuthoredQuestion[];
  count?: number;
}) {
  const items = selectQuiz(data, questions, { seedStr: PRINT_SEED, targetCount: count });

  return (
    <main className="container">
      <button type="button" className="btn btn-primary no-print" style={{ margin: "1rem 0" }} onClick={() => window.print()}>
        Print
      </button>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>{moduleLabel} — worksheet</h1>

      <ol style={{ paddingLeft: "1.3rem", display: "grid", gap: "0.9rem" }}>
        {items.map((item) => (
          <li key={item.id}>
            {item.prompt}
            {"options" in item && (
              <ul style={{ listStyle: "none", paddingLeft: "1rem", marginTop: "0.3rem" }}>
                {item.options.map((opt) => <li key={opt}>☐ {opt}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>

      <div style={{ pageBreakBefore: "always", marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>Answer key</h2>
        <ol style={{ paddingLeft: "1.3rem", display: "grid", gap: "0.4rem" }}>
          {items.map((item) => (
            <li key={item.id}>
              {answerText(item)} <span className="citation">({formatCitation(item.citation)})</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
