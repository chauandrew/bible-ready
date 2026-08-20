"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { bookRegistry, arcsForBook, dataForArcsInBook } from "@/lib/content";
import { selectQuizMulti } from "@/lib/quiz";
import BookPicker from "./BookPicker";
import ArcPicker, { type PickerGroup } from "./ArcPicker";
import QuizRunner from "./QuizRunner";
import CategoryBreakdown from "./CategoryBreakdown";

const COUNT_OPTIONS = [5, 10, 15, 25];

/** Every arc of every registered book, as `${bookId}::${arcId}` keys — arc ids aren't
 * guaranteed unique across books, so compound keys are the only safe default here. */
function allArcKeys(): string[] {
  return bookRegistry.flatMap((b) => arcsForBook(b.id).map((a) => `${b.id}::${a.id}`));
}

export default function MultiQuizSetup() {
  const router = useRouter();
  const params = useSearchParams();
  const seedFromUrl = params.get("s");
  const countFromUrl = Number(params.get("count"));
  const booksFromUrl = params.get("books")?.split(",").filter(Boolean) ?? [];
  const arcsFromUrl = params.get("arcs");

  const [count, setCount] = useState(COUNT_OPTIONS.includes(countFromUrl) ? countFromUrl : 10);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(booksFromUrl.length ? booksFromUrl : bookRegistry.map((b) => b.id))
  );
  const [selectedArcs, setSelectedArcs] = useState<Set<string>>(
    new Set(arcsFromUrl && arcsFromUrl !== "all" ? arcsFromUrl.split(",").filter(Boolean) : allArcKeys())
  );
  const [started, setStarted] = useState(!!seedFromUrl);
  const [seed] = useState(() => seedFromUrl ?? Math.random().toString(36).slice(2, 10));

  // Adding a book back defaults its sections to fully checked, same as the initial state.
  function handleBooksChange(next: Set<string>) {
    const added = [...next].filter((id) => !selected.has(id));
    if (added.length) {
      setSelectedArcs((prev) => {
        const merged = new Set(prev);
        for (const bookId of added) {
          for (const a of arcsForBook(bookId)) merged.add(`${bookId}::${a.id}`);
        }
        return merged;
      });
    }
    setSelected(next);
  }

  if (started) {
    const bookIds = booksFromUrl.length ? booksFromUrl : [...selected];
    const sources = bookIds
      .map((bookId) => {
        const arcIds = arcsForBook(bookId)
          .filter((a) => selectedArcs.has(`${bookId}::${a.id}`))
          .map((a) => a.id);
        return dataForArcsInBook(bookId, arcIds);
      })
      .filter((s): s is NonNullable<typeof s> => !!s);
    const items = selectQuizMulti(sources, { seedStr: `bible:${bookIds.join("+")}:${seed}`, targetCount: count });
    return (
      <QuizRunner
        items={items}
        mode="quiz"
        moduleId="bible"
        backHref="/"
        backLabel="Back to all books"
        resultsExtra={(report) => <CategoryBreakdown report={report} />}
      />
    );
  }

  const arcGroups: PickerGroup[] = [...selected].map((bookId) => ({
    heading: bookRegistry.find((b) => b.id === bookId)?.name ?? bookId,
    options: arcsForBook(bookId).map((a) => ({ key: `${bookId}::${a.id}`, label: a.name })),
  }));
  // Stale keys from a since-deselected book can linger in selectedArcs, so the
  // "is anything actually chosen" check counts only currently-visible options.
  const visibleArcCount = arcGroups.reduce((n, g) => n + g.options.filter((o) => selectedArcs.has(o.key)).length, 0);

  return (
    <main className="container">
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)", marginTop: "1rem" }}>
        Quiz across books
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
        Drawn from every book and section you pick below.
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

      <BookPicker books={bookRegistry} selected={selected} onChange={handleBooksChange} />

      {arcGroups.length > 0 && <ArcPicker groups={arcGroups} selected={selectedArcs} onChange={setSelectedArcs} />}

      <button
        type="button"
        className="btn btn-primary"
        disabled={selected.size === 0 || visibleArcCount === 0}
        onClick={() => {
          const allKeys = allArcKeys();
          const arcsParam =
            selectedArcs.size === allKeys.length && allKeys.every((k) => selectedArcs.has(k))
              ? "all"
              : [...selectedArcs].join(",");
          router.replace(`?s=${seed}&count=${count}&books=${[...selected].join(",")}&arcs=${arcsParam}`);
          setStarted(true);
        }}
      >
        Start
      </button>
    </main>
  );
}
