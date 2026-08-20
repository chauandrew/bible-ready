"use client";

import Link from "next/link";
import type { AuthoredQuestion } from "@/content/schema";
import type { BookData } from "@/lib/generate";
import { selectQuizMulti, type QuizItem } from "@/lib/quiz";
import QuizRunner from "./QuizRunner";

const CATEGORY_LABELS: Record<string, string> = {
  "mechanic:chapter": "Which chapter",
  "mechanic:location": "Where it happens",
  "mechanic:speaker": "Who says it",
  "mechanic:chapter-summary": "What a chapter is about",
  "mechanic:sequence": "Event order",
  "mechanic:match": "Matching",
  "mechanic:free-response": "What happens in a chapter",
  "theme:theme": "Themes",
  "theme:arc": "Narrative arcs",
  "theme:covenant": "Covenants",
  "theme:character": "Characters",
  "theme:argument": "Argument / structure",
};

const DIAGNOSTIC_SEED = "genesis-diagnostic-v1";
const DIAGNOSTIC_COUNT = 25;

export default function DiagnosticClient({
  sources,
  seedStr = DIAGNOSTIC_SEED,
  count = DIAGNOSTIC_COUNT,
  moduleId = "diagnostic",
  backHref = "/genesis",
}: {
  sources: { data: BookData; questions: AuthoredQuestion[] }[];
  seedStr?: string;
  count?: number;
  moduleId?: string;
  backHref?: string;
}) {
  const items: QuizItem[] = selectQuizMulti(sources, { seedStr, targetCount: count });

  return (
    <QuizRunner
      items={items}
      mode="quiz"
      moduleId={moduleId}
      backHref={backHref}
      resultsExtra={(report) => (
        <div style={{ marginBottom: "1.5rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Where to focus</p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {Object.entries(report)
              .sort((a, b) => a[1].percent - b[1].percent)
              .map(([cat, r]) => (
                <div key={cat} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="citation">
                    {r.right}/{r.right + r.wrong} ({r.percent}%)
                  </span>
                </div>
              ))}
          </div>
          <Link href="/study/chapters" className="btn" style={{ marginTop: "0.75rem" }}>
            Review chapters
          </Link>
        </div>
      )}
    />
  );
}
