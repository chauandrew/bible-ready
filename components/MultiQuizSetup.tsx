"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { bookRegistry, dataForBooks } from "@/lib/content";
import { poolsForTier, selectQuizMulti } from "@/lib/quiz";
import type { Tier } from "@/content/schema";
import BookPicker from "./BookPicker";
import QuizRunner from "./QuizRunner";
import CategoryBreakdown from "./CategoryBreakdown";

const COUNT_OPTIONS = [5, 10, 15, 25];

export default function MultiQuizSetup() {
  const router = useRouter();
  const params = useSearchParams();
  const seedFromUrl = params.get("s");
  const countFromUrl = Number(params.get("count"));
  const booksFromUrl = params.get("books")?.split(",").filter(Boolean) ?? [];
  const tierFromUrl: Tier | undefined = params.get("tier") === "general" ? "general" : undefined;

  const [count, setCount] = useState(COUNT_OPTIONS.includes(countFromUrl) ? countFromUrl : 10);
  const [tier, setTier] = useState<Tier | undefined>(tierFromUrl);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(booksFromUrl.length ? booksFromUrl : bookRegistry.map((b) => b.id))
  );
  const [started, setStarted] = useState(!!seedFromUrl);
  const [seed] = useState(() => seedFromUrl ?? Math.random().toString(36).slice(2, 10));

  // Untagged books contribute nothing to General mode, so the button says how
  // many questions the current selection can actually offer there.
  const generalAvailable = useMemo(() => {
    const { generated, authored } = poolsForTier(dataForBooks([...selected]), "general");
    return generated.length + authored.length;
  }, [selected]);

  if (started) {
    const bookIds = booksFromUrl.length ? booksFromUrl : [...selected];
    const sources = dataForBooks(bookIds);
    const items = selectQuizMulti(sources, {
      seedStr: `bible:${bookIds.join("+")}:${tier ?? "all"}:${seed}`,
      targetCount: count,
      tier,
    });
    return (
      <QuizRunner
        items={items}
        mode="quiz"
        moduleId="bible"
        backHref="/"
        backLabel="Back to all books"
        resultsExtra={(report) => <CategoryBreakdown report={report} />}
        singleBookId={bookIds.length === 1 ? bookIds[0] : undefined}
      />
    );
  }

  return (
    <main className="container">
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)", marginTop: "1rem" }}>
        Quiz across books
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
        Drawn from every module you pick below.
      </p>

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
        <p className="eyebrow" style={{ margin: "1rem 0 0.5rem" }}>Difficulty</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            style={!tier ? { borderColor: "var(--accent)" } : undefined}
            onClick={() => setTier(undefined)}
          >
            Everything
          </button>
          <button
            type="button"
            className="btn"
            style={tier === "general" ? { borderColor: "var(--accent)" } : undefined}
            onClick={() => setTier("general")}
          >
            General knowledge ({generalAvailable} available)
          </button>
        </div>
      </div>

      <BookPicker books={bookRegistry} selected={selected} onChange={setSelected} />

      <button
        type="button"
        className="btn btn-primary"
        disabled={selected.size === 0 || (tier === "general" && generalAvailable === 0)}
        onClick={() => {
          const tierParam = tier ? `&tier=${tier}` : "";
          router.replace(`?s=${seed}&count=${count}&books=${[...selected].join(",")}${tierParam}`);
          setStarted(true);
        }}
      >
        Start
      </button>
    </main>
  );
}
