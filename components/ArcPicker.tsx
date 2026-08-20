"use client";

export interface PickerGroup {
  heading?: string;
  options: { key: string; label: string }[];
}

/** Checkbox list for "which sections to cover" in the Quiz setup — a single ungrouped
 * list for one book, or grouped by book heading when several books are in play (their
 * arc ids aren't guaranteed unique across books, so callers key options as
 * `${bookId}::${arcId}` in that case). */
export default function ArcPicker({
  groups,
  selected,
  onChange,
}: {
  groups: PickerGroup[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Sections</p>
      {groups.map((g, i) => (
        <div key={g.heading ?? i} style={{ marginTop: i > 0 ? "0.75rem" : 0 }}>
          {g.heading && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
              {g.heading}
            </p>
          )}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {g.options.map((opt) => {
              const checked = selected.has(opt.key);
              return (
                <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(selected);
                      if (checked) next.delete(opt.key);
                      else next.add(opt.key);
                      onChange(next);
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
