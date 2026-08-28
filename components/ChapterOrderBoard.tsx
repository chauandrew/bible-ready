"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Chapter } from "@/content/schema";
import { shuffle, mulberry32 } from "@/lib/rng";
import { pointsColor } from "@/lib/quiz";
import { scoreChapterOrder, place, unplace, nextEmptySlot, type Placements } from "@/lib/chapterOrder";
import BookBreadcrumb from "./BookBreadcrumb";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

/** One chapter card: shows title+blurb only, never its own number, since
 * that's the answer. Doubles as a draggable (via dnd-kit) and a plain
 * click-to-place button (see ChapterOrderBoard's onClick). */
function ChapterCard({ chapter, onClick }: { chapter: Chapter; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: chapter.id });

  return (
    <button
      type="button"
      ref={setNodeRef}
      className="card chapter-card"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: "grab",
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        touchAction: "none",
        zIndex: isDragging ? 1 : "auto",
        position: "relative",
      }}
      {...attributes}
      {...listeners}
    >
      <div className="chapter-card-title">{chapter.title}</div>
      <p className="chapter-card-summary">{chapter.blurb ?? chapter.summary}</p>
    </button>
  );
}

/** A single numbered slot. Filled: the placed card's own ChapterCard (still
 * draggable/clickable to move it elsewhere). Empty: a button that "arms"
 * this exact slot as the click target for the next pool-card click, the
 * keyboard/no-drag path to an arbitrary slot (see onArmedClick below). */
function Slot({
  number,
  chapterLabel,
  chapter,
  armed,
  onArmedClick,
  onPlacedClick,
}: {
  number: number;
  chapterLabel: string;
  chapter: Chapter | undefined;
  armed: boolean;
  onArmedClick: () => void;
  onPlacedClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${number}` });
  const label = `${chapterLabel} ${number}`;

  return (
    <div
      ref={setNodeRef}
      style={{
        border: `1px ${isOver ? "solid" : "dashed"} ${isOver || armed ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        background: armed ? "var(--surface-2)" : undefined,
        padding: chapter ? 0 : "0.7rem 0.85rem",
        minHeight: "3rem",
        display: "flex",
        alignItems: "center",
      }}
    >
      {chapter ? (
        <div style={{ width: "100%" }}>
          <ChapterCard chapter={chapter} onClick={onPlacedClick} />
        </div>
      ) : (
        <button
          type="button"
          className="chapter-card-number"
          aria-pressed={armed}
          aria-label={`${label}, empty. ${armed ? "Selected as target" : "Select as the target for the next chapter you pick"}.`}
          onClick={onArmedClick}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "inherit" }}
        >
          {label}
        </button>
      )}
    </div>
  );
}

export default function ChapterOrderBoard({
  bookId,
  bookName,
  chapterLabel,
  chapters,
  backHref,
}: {
  bookId: string;
  bookName: string;
  chapterLabel: string;
  chapters: Chapter[];
  backHref: string;
}) {
  const router = useRouter();
  // Starts unshuffled: the static-export build runs this component once at
  // build time, and the browser runs it again on hydration; Date.now() at
  // those two moments differs, so seeding the shuffle at initial-render time
  // would make the server-rendered HTML and the client's first render
  // disagree (a React hydration-mismatch error). Reshuffling in an effect,
  // after both of those renders have already matched, sidesteps that: the
  // current-time seed only ever runs once, client-side, post-mount.
  const [shuffledIds, setShuffledIds] = useState(() => chapters.map((c) => c.id));
  useEffect(() => {
    // A genuinely time-varying reshuffle has to happen after mount no
    // matter what; there's no way to compute it during render without
    // reintroducing the mismatch above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShuffledIds((ids) => shuffle(ids, mulberry32(Date.now())));
  }, []);
  const [placements, setPlacements] = useState<Placements>({});
  const [armedSlot, setArmedSlot] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const placedIds = useMemo(() => new Set(Object.values(placements).filter((id): id is string => !!id)), [placements]);
  const pool = shuffledIds.filter((id) => !placedIds.has(id));
  const sortedChapters = useMemo(() => [...chapters].sort((a, b) => a.number - b.number), [chapters]);

  /** A pool card click either fills the armed slot (if one is selected -
   * the keyboard/no-drag path to an arbitrary slot) or falls back to the
   * fast "next open slot" path, matching the room-for-either behavior the
   * click instructions describe. */
  function handlePoolCardClick(chapterId: string) {
    if (armedSlot !== null) {
      setPlacements((p) => place(p, chapterId, armedSlot));
      setArmedSlot(null);
      return;
    }
    setPlacements((p) => {
      const slot = nextEmptySlot(chapters, p);
      return slot === null ? p : place(p, chapterId, slot);
    });
  }

  function toggleArmed(slotNumber: number) {
    setArmedSlot((current) => (current === slotNumber ? null : slotNumber));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setArmedSlot(null);
    if (!over) return;
    const chapterId = String(active.id);
    if (over.id === "pool") {
      setPlacements((p) => unplace(p, chapterId));
      return;
    }
    const match = /^slot-(\d+)$/.exec(String(over.id));
    if (match) setPlacements((p) => place(p, chapterId, Number(match[1])));
  }

  const capitalizedLabel = chapterLabel.charAt(0).toUpperCase() + chapterLabel.slice(1);

  if (submitted) {
    const score = scoreChapterOrder(chapters, placements);
    return (
      <main className="container-wide">
        <BookBreadcrumb bookId={bookId} bookName={bookName} />
        <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 1.15rem + 0.9vw, 1.75rem)", marginTop: "1rem" }}>
          Score: {score.correctCount}/{score.total}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>{score.percent}% correct</p>

        <div style={{ display: "grid", gap: "0.6rem", margin: "0.5rem 0 1.5rem" }}>
          {score.results
            .sort((a, b) => a.chapter.number - b.chapter.number)
            .map((r) => (
              <div key={r.chapter.id} className="card">
                <div className="chapter-card-head">
                  <span className="chapter-card-number">
                    {bookName} {r.chapter.number}
                  </span>
                </div>
                <div className="chapter-card-title">{r.chapter.title}</div>
                <p className="chapter-card-summary">{r.chapter.summary}</p>
                <div className="note" style={{ borderColor: pointsColor(r.correct ? 1 : 0) }}>
                  {r.correct
                    ? "✓ Correct"
                    : r.placedSlot !== null
                    ? `✗ You placed it in ${chapterLabel} ${r.placedSlot}`
                    : "✗ Not placed"}
                </div>
              </div>
            ))}
        </div>

        <button type="button" className="btn btn-primary" onClick={() => router.push(backHref)}>
          Back to {bookName}
        </button>
      </main>
    );
  }

  return (
    <main className="container-wide">
      <BookBreadcrumb bookId={bookId} bookName={bookName} />
      <h1 className="page-title" style={{ margin: "1rem 0 0.25rem" }}>
        Order the {chapterLabel}s
      </h1>
      <p className="citation" style={{ marginBottom: "1rem" }}>
        Drag a card to a specific slot, or click an empty slot to target it and then click the chapter you want there.
        Click a card with no slot targeted to drop it in the next open one.
      </p>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <p className="eyebrow">Unplaced ({pool.length})</p>
        <PoolArea>
          <div className="chapter-card-grid" style={{ marginBottom: "1.5rem" }}>
            {pool.map((id) => (
              <ChapterCard key={id} chapter={chapterById.get(id)!} onClick={() => handlePoolCardClick(id)} />
            ))}
          </div>
        </PoolArea>

        <p className="eyebrow">{capitalizedLabel}s</p>
        <div className="chapter-card-grid" style={{ marginBottom: "1.5rem" }}>
          {sortedChapters.map((c) => {
            const placedId = placements[c.number];
            const placedChapter = placedId ? chapterById.get(placedId) : undefined;
            return (
              <Slot
                key={c.number}
                number={c.number}
                chapterLabel={capitalizedLabel}
                chapter={placedChapter}
                armed={armedSlot === c.number}
                onArmedClick={() => toggleArmed(c.number)}
                onPlacedClick={() => setPlacements((p) => unplace(p, placedChapter!.id))}
              />
            );
          })}
        </div>
      </DndContext>

      {pool.length > 0 && (
        <p className="citation" style={{ marginBottom: "0.5rem" }}>
          {pool.length} {chapterLabel}
          {pool.length === 1 ? "" : "s"} not yet placed; they&apos;ll be marked incorrect.
        </p>
      )}
      <button type="button" className="btn btn-primary" onClick={() => setSubmitted(true)}>
        Submit
      </button>
    </main>
  );
}

/** A droppable wrapper around the unplaced pool, so dragging a placed card
 * back out onto it unplaces that card. */
function PoolArea({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "pool" });
  return <div ref={setNodeRef}>{children}</div>;
}
