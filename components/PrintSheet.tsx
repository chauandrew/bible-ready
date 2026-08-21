"use client";

import Link from "next/link";
import type { AuthoredQuestion } from "@/content/schema";
import type { BookData } from "@/lib/generate";
import { selectQuiz, type QuizItem } from "@/lib/quiz";
import { formatCitation, chapterSummaryFor } from "@/lib/content";

const PRINT_SEED = "print-v1";

function answerText(item: QuizItem): string {
  if ("correctIndex" in item) return item.options[item.correctIndex];
  if ("correctChapter" in item) return formatCitation({ book: item.citation.book, chapter: item.correctChapter });
  if ("correctOrder" in item) return item.correctOrder.join(" → ");
  if ("correctPairs" in item) return item.correctPairs.map((p) => `${p.left} → ${p.right}`).join("; ");
  return chapterSummaryFor(item.citation.book, item.chapterNumber) ?? "";
}

export default function PrintSheet({
  moduleLabel,
  data,
  questions,
  count = 20,
  backHref,
  backLabel,
}: {
  moduleLabel: string;
  data: BookData;
  questions: AuthoredQuestion[];
  count?: number;
  backHref?: string;
  backLabel?: string;
}) {
  const items = selectQuiz(data, questions, { seedStr: PRINT_SEED, targetCount: count });

  return (
    <main className="container">
      {backHref && (
        <p className="eyebrow no-print" style={{ marginTop: "1rem" }}>
          <Link href={backHref}>{backLabel}</Link>
        </p>
      )}
      <button type="button" className="btn btn-primary no-print" style={{ margin: "1rem 0" }} onClick={() => window.print()}>
        Print
      </button>
      <h1 className="page-title" style={{ marginBottom: "1rem" }}>{moduleLabel} worksheet</h1>

      <ol style={{ paddingLeft: "1.3rem", display: "grid", gap: "0.9rem" }}>
        {items.map((item) => (
          <li key={item.id}>
            {item.prompt}
            {"options" in item && (
              <ul style={{ listStyle: "none", paddingLeft: "1rem", marginTop: "0.3rem" }}>
                {item.options.map((opt) => <li key={opt}>☐ {opt}</li>)}
              </ul>
            )}
            {/* Sequence and match items used to print as a bare prompt with
                nothing to order or match — unanswerable on paper. */}
            {"displayItems" in item && (
              <ul style={{ listStyle: "none", paddingLeft: "1rem", marginTop: "0.3rem" }}>
                {item.displayItems.map((entry) => <li key={entry}>___ {entry}</li>)}
              </ul>
            )}
            {"lefts" in item && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", paddingLeft: "1rem", marginTop: "0.3rem" }}>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {item.lefts.map((left) => <li key={left}>___ {left}</li>)}
                </ul>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {item.rights.map((right, i) => <li key={right}>{String.fromCharCode(65 + i)}. {right}</li>)}
                </ul>
              </div>
            )}
            {/* Free-response: no options to print, just ruled lines to write on. */}
            {"terms" in item && (
              <div style={{ paddingLeft: "1rem", marginTop: "0.5rem", display: "grid", gap: "0.6rem" }} aria-hidden="true">
                <div style={{ borderBottom: "1px solid #999" }} />
                <div style={{ borderBottom: "1px solid #999" }} />
                <div style={{ borderBottom: "1px solid #999" }} />
              </div>
            )}
            {/* Chapter-guess: a single short blank for "book, chapter", not a whole ruled paragraph. */}
            {"correctChapter" in item && (
              <p style={{ paddingLeft: "1rem", marginTop: "0.4rem" }} aria-hidden="true">
                Book: _______________  Chapter: _______
              </p>
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
