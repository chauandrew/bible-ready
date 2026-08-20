"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { bookRegistry, dataForBooks } from "@/lib/content";
import { selectQuizMulti } from "@/lib/quiz";
import BookPicker from "./BookPicker";
import QuizRunner from "./QuizRunner";

export default function MultiQuizSetup({ defaultCount = 15 }: { defaultCount?: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const seedFromUrl = params.get("s");
  const modeFromUrl = params.get("mode") === "quiz" ? "quiz" : params.get("mode") === "study" ? "study" : null;
  const booksFromUrl = params.get("books")?.split(",").filter(Boolean) ?? [];

  const [mode, setMode] = useState<"study" | "quiz">(modeFromUrl ?? "study");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(booksFromUrl.length ? booksFromUrl : bookRegistry.map((b) => b.id))
  );
  const [started, setStarted] = useState(!!seedFromUrl);
  const [seed] = useState(() => seedFromUrl ?? Math.random().toString(36).slice(2, 10));

  if (started) {
    const bookIds = booksFromUrl.length ? booksFromUrl : [...selected];
    const sources = dataForBooks(bookIds);
    const items = selectQuizMulti(sources, { seedStr: `bible:${bookIds.join("+")}:${seed}`, targetCount: defaultCount });
    return <QuizRunner items={items} mode={mode} moduleId="bible" backHref="/" backLabel="Back to all books" />;
  }

  return (
    <main className="container">
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)", marginTop: "1rem" }}>
        Quiz — combine books
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
        {defaultCount} questions, drawn from every book you select below.
      </p>

      <BookPicker books={bookRegistry} selected={selected} onChange={setSelected} />

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
        disabled={selected.size === 0}
        onClick={() => {
          router.replace(`?s=${seed}&mode=${mode}&books=${[...selected].join(",")}`);
          setStarted(true);
        }}
      >
        Start
      </button>
    </main>
  );
}
