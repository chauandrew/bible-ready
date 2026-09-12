import type { Chapter } from "../content/schema";

/**
 * Scoring + placement logic for the standalone "Chapter Order" board
 * (components/ChapterOrderBoard.tsx). Kept separate from lib/quiz.ts's
 * QuizItem/Answer engine on purpose: every chapter is both a slot and a
 * card, 1:1 by construction, so there's no distractor pool to build and
 * none of that engine's machinery fits.
 */

/** Slot number (a chapter's real `number`) -> the id of the chapter card
 * placed there, or null/absent if empty. The "unplaced pool" is never
 * stored; a chapter is unplaced iff its id appears in no slot. */
export type Placements = Record<number, string | null>;

export interface ChapterOrderResult {
  chapter: Chapter;
  placedSlot: number | null;
  correct: boolean;
  /** 1 for an exact match, 0.5 for a slot exactly one off (a near miss on
   * ordering, not on knowing the chapter), 0 otherwise — same half-credit
   * treatment as a one-off chapter guess in lib/quiz.ts's pointsFor. */
  points: number;
}

export interface ChapterOrderScore {
  results: ChapterOrderResult[];
  /** Sum of each result's points — fractional whenever a near miss scores
   * 0.5, so display it with the same formatPoints style quiz scores use. */
  correctCount: number;
  total: number;
  percent: number;
}

/** Slot N is correct iff it holds chapter N's own card. Landing exactly one
 * slot off earns half credit. A chapter left in the unplaced pool is
 * graded wrong, not excluded: partial submission is allowed. */
export function scoreChapterOrder(chapters: Chapter[], placements: Placements): ChapterOrderScore {
  const slotByChapterId = new Map<string, number>();
  for (const [slot, chapterId] of Object.entries(placements)) {
    if (chapterId) slotByChapterId.set(chapterId, Number(slot));
  }

  const results: ChapterOrderResult[] = chapters.map((chapter) => {
    const placedSlot = slotByChapterId.get(chapter.id) ?? null;
    const correct = placedSlot === chapter.number;
    const points = correct ? 1 : placedSlot !== null && Math.abs(placedSlot - chapter.number) === 1 ? 0.5 : 0;
    return { chapter, placedSlot, correct, points };
  });

  const correctCount = results.reduce((sum, r) => sum + r.points, 0);
  const total = chapters.length;
  return { results, correctCount, total, percent: total ? Math.round((correctCount / total) * 100) : 0 };
}

/** Removes chapterId from whichever slot currently holds it, if any. Non-mutating. */
export function unplace(placements: Placements, chapterId: string): Placements {
  const next = { ...placements };
  for (const [slot, id] of Object.entries(next)) {
    if (id === chapterId) next[Number(slot)] = null;
  }
  return next;
}

/** Clears chapterId's old slot (if any), then sets it into slotNumber.
 * Whatever card previously occupied slotNumber is implicitly bumped back to
 * the pool, since its id no longer appears anywhere in the map. */
export function place(placements: Placements, chapterId: string, slotNumber: number): Placements {
  const cleared = unplace(placements, chapterId);
  return { ...cleared, [slotNumber]: chapterId };
}

/** Lowest chapter-number slot with no card, or null if the board is full.
 * Powers the click-to-place-next fast path. */
export function nextEmptySlot(chapters: Chapter[], placements: Placements): number | null {
  const numbers = chapters.map((c) => c.number).sort((a, b) => a - b);
  return numbers.find((n) => !placements[n]) ?? null;
}
