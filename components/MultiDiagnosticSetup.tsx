"use client";

import { useState } from "react";
import { bookRegistry, dataForBooks } from "@/lib/content";
import BookPicker from "./BookPicker";
import DiagnosticClient from "./DiagnosticClient";

export default function MultiDiagnosticSetup() {
  const [selected, setSelected] = useState<Set<string>>(new Set(bookRegistry.map((b) => b.id)));
  const [started, setStarted] = useState(false);

  if (started) {
    const bookIds = [...selected];
    const sources = dataForBooks(bookIds);
    return (
      <DiagnosticClient
        sources={sources}
        seedStr={`bible-diagnostic-v1:${bookIds.sort().join("+")}`}
        moduleId="diagnostic-bible"
        backHref="/"
      />
    );
  }

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: "1rem" }}>Diagnostic — combine books</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
        A fixed 25-question exam across the books you select, then a breakdown of where to focus.
      </p>

      <BookPicker books={bookRegistry} selected={selected} onChange={setSelected} />

      <button type="button" className="btn btn-primary" disabled={selected.size === 0} onClick={() => setStarted(true)}>
        Start
      </button>
    </main>
  );
}
