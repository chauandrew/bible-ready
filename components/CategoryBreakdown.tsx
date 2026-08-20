import Link from "next/link";
import type { gapReport } from "@/lib/quiz";

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

/** Per-category right/wrong breakdown shown after any Quiz — "where to focus" next. */
export default function CategoryBreakdown({
  report,
  chaptersHref,
}: {
  report: ReturnType<typeof gapReport>;
  chaptersHref?: string;
}) {
  return (
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
      {chaptersHref && (
        <Link href={chaptersHref} className="btn" style={{ marginTop: "0.75rem" }}>
          Review chapters
        </Link>
      )}
    </div>
  );
}
