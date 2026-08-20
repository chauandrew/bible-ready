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
    <main className="container">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        {arc ? <Link href={`/study/arcs/${arc.id}`}>{arc.name}</Link> : null}
      </p>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>
        Genesis {chapter.number} — {chapter.title}
      </h1>
      <p style={{ marginBottom: "1.25rem" }}>{chapter.summary}</p>

      {events.length > 0 && (
        <>
          <p className="eyebrow">What happens</p>
          <div style={{ display: "grid", gap: "0.5rem", margin: "0.5rem 0 1.5rem" }}>
            {events.map((e) => (
              <div key={e.id} className="card">
                <div style={{ fontWeight: 600 }}>{e.name}</div>
                <div className="citation" style={{ marginTop: "0.2rem" }}>
                  {e.place} · {formatCitation(e.citation)}
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
