"use client";

import type { Book } from "@/content/schema";

/** Checkbox list for choosing which books a whole-Bible / multi-book quiz, diagnostic,
 * or flashcard session should draw from. Reused across all three so "just Genesis" and
 * "everything" are the same picker, not separate features. */
export default function BookPicker({
  books,
  selected,
  onChange,
}: {
  books: Book[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Books</p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {books.map((b) => {
          const checked = selected.has(b.id);
          return (
            <label key={b.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = new Set(selected);
                  if (checked) next.delete(b.id);
                  else next.add(b.id);
                  onChange(next);
                }}
              />
              {b.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}
