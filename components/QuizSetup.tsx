"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Arc } from "@/content/schema";
import { dataForArcsInBook } from "@/lib/content";
import { selectQuizMulti } from "@/lib/quiz";
import QuizRunner from "./QuizRunner";
import CategoryBreakdown from "./CategoryBreakdown";
import ArcPicker from "./ArcPicker";

const COUNT_OPTIONS = [5, 10, 15, 25];

export default function QuizSetup({
  bookId,
  bookName,
  arcs,
  backHref,
  backLabel,
  chaptersHref,
}: {
  bookId: string;
  bookName: string;
  arcs: Arc[];
  backHref: string;
  backLabel: string;
  chaptersHref: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const seedFromUrl = params.get("s");
  const countFromUrl = Number(params.get("count"));
  const arcsFromUrl = params.get("arcs");

  const [count, setCount] = useState(COUNT_OPTIONS.includes(countFromUrl) ? countFromUrl : 10);
  const [selectedArcs, setSelectedArcs] = useState<Set<string>>(
    new Set(arcsFromUrl && arcsFromUrl !== "all" ? arcsFromUrl.split(",").filter(Boolean) : arcs.map((a) => a.id))
  );
  const [started, setStarted] = useState(!!seedFromUrl);
  const [seed] = useState(() => seedFromUrl ?? Math.random().toString(36).slice(2, 10));

  if (started) {
    const source = dataForArcsInBook(bookId, [...selectedArcs]);
    const items = source ? selectQuizMulti([source], { seedStr: `${bookId}:${seed}`, targetCount: count }) : [];
    return (
      <QuizRunner
        items={items}
        mode="quiz"
        moduleId={bookId}
        backHref={backHref}
        backLabel={backLabel}
        resultsExtra={(report) => <CategoryBreakdown report={report} chaptersHref={chaptersHref} />}
      />
    );
  }

  return (
    <main className="container">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        <Link href={backHref}>{bookName}</Link>
      </p>
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)" }}>
        {bookName} quiz
      </h1>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Questions</p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className="btn"
              style={count === n ? { borderColor: "var(--accent)" } : undefined}
              onClick={() => setCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <ArcPicker
        groups={[{ options: arcs.map((a) => ({ key: a.id, label: a.name })) }]}
        selected={selectedArcs}
        onChange={setSelectedArcs}
      />

      <button
        type="button"
        className="btn btn-primary"
        disabled={selectedArcs.size === 0}
        onClick={() => {
          const arcsParam = selectedArcs.size === arcs.length ? "all" : [...selectedArcs].join(",");
          router.replace(`?s=${seed}&count=${count}&arcs=${arcsParam}`);
          setStarted(true);
        }}
      >
        Start
      </button>
    </main>
  );
}
