import Link from "next/link";
import { notFound } from "next/navigation";
import { chapters, chapterByNumber, arcById, eventsForChapter, personsForEvent, formatCitation } from "@/lib/content";

export function generateStaticParams() {
  return chapters.map((c) => ({ number: String(c.number) }));
}

export default async function ChapterPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const chapter = chapterByNumber.get(Number(number));
  if (!chapter) notFound();

  const arc = arcById.get(chapter.arcId);
  const events = eventsForChapter(chapter.number);
  const prev = chapterByNumber.get(chapter.number - 1);
  const next = chapterByNumber.get(chapter.number + 1);

  return (
    <main className="container" style={{ maxWidth: "760px" }}>
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        {arc ? <Link href={`/study/arcs/${arc.id}`}>{arc.name}</Link> : null}
      </p>
      <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.85rem)" }}>
        Genesis {chapter.number}
      </h1>
      <p className="chapter-card-title" style={{ fontSize: "1.1rem" }}>{chapter.title}</p>
      <p style={{ marginBottom: "1.25rem" }}>{chapter.summary}</p>

      {events.length > 0 && (
        <>
          <p className="eyebrow">What happens</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.5rem", margin: "0.5rem 0 1.5rem" }}>
            {events.map((e) => (
              <div key={e.id} className="card">
                <div style={{ fontWeight: 600 }}>{e.name}</div>
                <div className="citation" style={{ marginTop: "0.2rem" }}>
                  {e.place ? `${e.place} · ` : ""}
                  {formatCitation(e.citation)}
                  {personsForEvent(e).length > 0 && ` · ${personsForEvent(e).map((p) => p.name).join(", ")}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
        {prev ? <Link href={`/study/chapters/${prev.number}`} className="btn">← Genesis {prev.number}</Link> : <span />}
        {next ? <Link href={`/study/chapters/${next.number}`} className="btn">Genesis {next.number} →</Link> : <span />}
      </div>
    </main>
  );
}
