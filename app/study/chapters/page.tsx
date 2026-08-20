import Link from "next/link";
import { arcs, chaptersForArc } from "@/lib/content";

export default function ChaptersIndex() {
  return (
    <main className="container-wide">
      <h1 className="page-title" style={{ margin: "1rem 0 1.25rem" }}>Chapters</h1>
      {arcs.map((arc) => (
        <details key={arc.id} className="arc-disclosure" open>
          <summary>
            <span className="section-title" style={{ margin: 0 }}>{arc.name}</span>
            <span className="citation">
              {arc.startChapter}–{arc.endChapter}
            </span>
          </summary>
          <div className="chapter-card-grid">
            {chaptersForArc(arc.id).map((c) => (
              <Link key={c.id} href={`/study/chapters/${c.number}`} className="card chapter-card">
                <div className="chapter-card-head">
                  <span className="chapter-card-number">Genesis {c.number}</span>
                  <span className="chapter-card-view">View details →</span>
                </div>
                <div className="chapter-card-title">{c.title}</div>
                <p className="chapter-card-summary">{c.summary}</p>
              </Link>
            ))}
          </div>
        </details>
      ))}
    </main>
  );
}
