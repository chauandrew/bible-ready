"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { bookRegistry, dataForBooks } from "@/lib/content";
import { selectQuizMulti } from "@/lib/quiz";
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

  const [count, setCount] = useState(COUNT_OPTIONS.includes(countFromUrl) ? countFromUrl : 10);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(booksFromUrl.length ? booksFromUrl : bookRegistry.map((b) => b.id))
  );
  const [started, setStarted] = useState(!!seedFromUrl);
  const [seed] = useState(() => seedFromUrl ?? Math.random().toString(36).slice(2, 10));

  if (started) {
    const bookIds = booksFromUrl.length ? booksFromUrl : [...selected];
    const sources = dataForBooks(bookIds);
    const items = selectQuizMulti(sources, { seedStr: `bible:${bookIds.join("+")}:${seed}`, targetCount: count });
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
      </div>

      <BookPicker books={bookRegistry} selected={selected} onChange={setSelected} />

      <button
        type="button"
        className="btn btn-primary"
        disabled={selected.size === 0}
        onClick={() => {
          router.replace(`?s=${seed}&count=${count}&books=${[...selected].join(",")}`);
          setStarted(true);
        }}
      >
        Start
      </button>
    </main>
  );
}
