import type { AuthoredQuestion, Citation } from "../content/schema";
import { mulberry32, hashSeed, shuffle } from "./rng";
import { gradeFreeResponse } from "./grade";
import { chapterSummaryFor, formatCitation, bookMeta } from "./content";
import {
  generateAll,
  toRuntimeMC,
  toRuntimeChapterGuess,
  toRuntimeSequence,
  toRuntimeMatch,
  toRuntimeFreeResponse,
  type BookData,
  type GeneratedItem,
  type GeneratedMC,
  type GeneratedChapterGuess,
  type GeneratedSequence,
  type GeneratedMatch,
  type GeneratedFreeResponse,
  type RuntimeMC,
  type RuntimeChapterGuess,
  type RuntimeSequence,
  type RuntimeMatch,
  type RuntimeFreeResponse,
} from "./generate";

/**
 * The quiz engine: mixes the generated pool with hand-authored thematic
 * questions into one seeded, replayable quiz, and scores the result
 * (including the Quiz's per-category gap report).
 */

export interface RuntimeAuthoredMC {
  kind: "authored";
  id: string;
  category: AuthoredQuestion["category"];
  prompt: string;
  options: string[];
  correctIndex: number;
  citation: Citation;
  explanation?: string;
}

export type QuizItem = RuntimeAuthoredMC | RuntimeMC | RuntimeChapterGuess | RuntimeSequence | RuntimeMatch | RuntimeFreeResponse;

function toRuntimeAuthored(q: AuthoredQuestion, seed: number): RuntimeAuthoredMC {
  const rand = mulberry32(seed);
  const correctText = q.options[q.correctIndex];
  const options = shuffle(q.options, rand);
  return {
    kind: "authored",
    id: q.id,
    category: q.category,
    prompt: q.prompt,
    options,
    correctIndex: options.indexOf(correctText),
    citation: q.citation,
    explanation: q.explanation,
  };
}

export interface SelectQuizOptions {
  /** Any string — a URL query param is the intended source. Same seedStr -> same quiz. */
  seedStr: string;
  targetCount: number;
  /** Fraction of targetCount drawn from the generated pool. Default 0.6. */
  generatedRatio?: number;
}

export function selectQuiz(
  data: BookData,
  authoredQuestions: AuthoredQuestion[],
  opts: SelectQuizOptions
): QuizItem[] {
  return selectFromPools(generateAll(data), authoredQuestions, opts);
}

/** Same selection logic as {@link selectQuiz}, but drawing from several books' pools at
 * once — each book is still generated on its own proven-clean data (see BookData's
 * `scopeChapters` doc), only the resulting items are merged, so combining books can't
 * introduce the cross-book ambiguity that merging raw content would (e.g. two books both
 * having a "chapter 3"). */
export function selectQuizMulti(
  sources: { data: BookData; questions: AuthoredQuestion[] }[],
  opts: SelectQuizOptions
): QuizItem[] {
  const generatedPool = sources.flatMap((s) => generateAll(s.data));
  const authoredPool = sources.flatMap((s) => s.questions);
  return selectFromPools(generatedPool, authoredPool, opts);
}

/** Picks the single global "question of the day" — same date -> same item, deterministically seeded. */
export function selectDailyQuestion(
  sources: { data: BookData; questions: AuthoredQuestion[] }[],
  dateStr: string // "YYYY-MM-DD", Pacific-time day
): QuizItem {
  const generatedPool = sources.flatMap((s) => generateAll(s.data));
  const authoredPool = sources.flatMap((s) => s.questions);
  const combined: QuizItem[] = [
    ...authoredPool.map((q) => toRuntimeAuthored(q, hashSeed(`qotd:${dateStr}:${q.id}`))),
    ...generatedPool.map((g) => {
      const itemSeed = hashSeed(`qotd:${dateStr}:${g.id}`);
      if (g.type === "sequence") return toRuntimeSequence(g as GeneratedSequence, itemSeed);
      if (g.type === "match") return toRuntimeMatch(g as GeneratedMatch, itemSeed);
      if (g.type === "free-response") return toRuntimeFreeResponse(g as GeneratedFreeResponse);
      if (g.type === "chapter-guess") return toRuntimeChapterGuess(g as GeneratedChapterGuess);
      return toRuntimeMC(g as GeneratedMC, itemSeed);
    }),
  ];
  const index = hashSeed(`qotd:${dateStr}`) % combined.length;
  return combined[index];
}

function selectFromPools(
  generatedPool: GeneratedItem[],
  authoredQuestions: AuthoredQuestion[],
  opts: SelectQuizOptions
): QuizItem[] {
  const { seedStr, targetCount, generatedRatio = 0.6 } = opts;

  const desiredGenerated = Math.round(targetCount * generatedRatio);
  const desiredAuthored = targetCount - desiredGenerated;

  // Fall back to generated-only when the book has no authored items yet, so a
  // newly added book is quiz-able the day its events land.
  const authoredCount = Math.min(desiredAuthored, authoredQuestions.length);
  const generatedCount = Math.min(targetCount - authoredCount, generatedPool.length);

  const pickedAuthored = shuffle(authoredQuestions, mulberry32(hashSeed(`${seedStr}:authored`))).slice(
    0,
    authoredCount
  );
  const pickedGenerated = shuffle(generatedPool, mulberry32(hashSeed(`${seedStr}:generated`))).slice(
    0,
    generatedCount
  );

  const items: QuizItem[] = [
    ...pickedAuthored.map((q) => toRuntimeAuthored(q, hashSeed(`${seedStr}:${q.id}`))),
    ...pickedGenerated.map((g) => {
      const itemSeed = hashSeed(`${seedStr}:${g.id}`);
      if (g.type === "sequence") return toRuntimeSequence(g as GeneratedSequence, itemSeed);
      if (g.type === "match") return toRuntimeMatch(g as GeneratedMatch, itemSeed);
      if (g.type === "free-response") return toRuntimeFreeResponse(g as GeneratedFreeResponse);
      if (g.type === "chapter-guess") return toRuntimeChapterGuess(g as GeneratedChapterGuess);
      return toRuntimeMC(g as GeneratedMC, itemSeed);
    }),
  ];

  return shuffle(items, mulberry32(hashSeed(`${seedStr}:order`)));
}

// ---------------------------------------------------------------------------
// Answers + scoring
// ---------------------------------------------------------------------------

export type Answer =
  | { itemId: string; kind: "mc"; selectedIndex: number }
  | { itemId: string; kind: "chapter-guess"; book: string; chapter: number }
  | { itemId: string; kind: "sequence"; order: string[] }
  | { itemId: string; kind: "match"; pairs: { left: string; right: string }[] }
  | { itemId: string; kind: "free-response"; text: string };

export function isCorrect(item: QuizItem, answer: Answer): boolean {
  if (item.kind === "authored" || item.type === "location" || item.type === "speaker" || item.type === "chapter-summary") {
    return answer.kind === "mc" && answer.selectedIndex === item.correctIndex;
  }
  if (item.type === "chapter-guess") {
    return answer.kind === "chapter-guess" && answer.book === item.citation.book && answer.chapter === item.correctChapter;
  }
  if (item.type === "sequence") {
    return answer.kind === "sequence" && JSON.stringify(answer.order) === JSON.stringify(item.correctOrder);
  }
  if (item.type === "match") {
    if (answer.kind !== "match") return false;
    const correctSet = new Set(item.correctPairs.map((p) => `${p.left}::${p.right}`));
    const answerSet = new Set(answer.pairs.map((p) => `${p.left}::${p.right}`));
    return correctSet.size === answerSet.size && [...correctSet].every((p) => answerSet.has(p));
  }
  if (item.type === "free-response") {
    return (
      answer.kind === "free-response" &&
      gradeFreeResponse({ terms: item.terms, minTerms: item.minTerms }, answer.text).correct
    );
  }
  return false;
}

/** The most points a single item can contribute — 1 for every item type
 * except sequence and match, which are worth 0.5 per option/pair (see
 * pointsFor) since they're made of several independently-gradable pieces
 * rather than one right/wrong choice. Used to compute a quiz's total
 * possible score (scoreQuiz) and each item's own "out of" denominator. */
export function maxPointsFor(item: QuizItem): number {
  if (item.kind === "generated" && item.type === "sequence") return item.correctOrder.length * 0.5;
  if (item.kind === "generated" && item.type === "match") return item.correctPairs.length * 0.5;
  return 1;
}

/** Fractional credit per answer. Sequence and match give 0.5 per correct
 * position/pair — a 6-item sequence with 3 in their right spot scores 1.5,
 * out of a 3.0 max (see maxPointsFor) — rather than the old all-or-nothing
 * grading, since getting most of a long ordering/matching question right
 * reflects real partial knowledge the same way a near-miss chapter guess
 * does. Every other item type is worth 1 or 0, via isCorrect, with the one
 * exception of a chapter-guess that names the right book but lands exactly
 * one chapter off (a near miss on numbering, not on knowing the material),
 * worth 0.5. */
export function pointsFor(item: QuizItem, answer: Answer): number {
  if (item.kind === "generated" && item.type === "sequence") {
    if (answer.kind !== "sequence") return 0;
    let correctPositions = 0;
    for (let i = 0; i < item.correctOrder.length; i++) {
      if (answer.order[i] === item.correctOrder[i]) correctPositions++;
    }
    return correctPositions * 0.5;
  }
  if (item.kind === "generated" && item.type === "match") {
    if (answer.kind !== "match") return 0;
    const correctSet = new Set(item.correctPairs.map((p) => `${p.left}::${p.right}`));
    let correctPairs = 0;
    for (const p of answer.pairs) {
      if (correctSet.has(`${p.left}::${p.right}`)) correctPairs++;
    }
    return correctPairs * 0.5;
  }
  if (isCorrect(item, answer)) return 1;
  if (item.kind === "generated" && item.type === "chapter-guess" && answer.kind === "chapter-guess") {
    if (answer.book === item.citation.book && Math.abs(answer.chapter - item.correctChapter) === 1) return 0.5;
  }
  return 0;
}

/** Border color for a points value against its max (default 1, the common
 * case) — shared by QuizRunner's review list and ChapterGuessQuestion's
 * inline Study-mode feedback so the three-way correct/close/wrong palette
 * can't drift between the two. */
export function pointsColor(points: number, max = 1): string {
  return points >= max ? "var(--success-border)" : points > 0 ? "var(--accent)" : "var(--danger-border)";
}

/** The correct answer, in display form — same derivation QuizRunner's review list
 * uses, pulled out here so other callers (the daily question) don't duplicate it. */
export function correctAnswerText(item: QuizItem): string {
  if ("correctIndex" in item) return item.options[item.correctIndex];
  if ("correctChapter" in item) return formatCitation({ book: item.citation.book, chapter: item.correctChapter });
  if ("correctOrder" in item) return item.correctOrder.join(" → ");
  if ("correctPairs" in item) return item.correctPairs.map((p) => `${p.left} → ${p.right}`).join(", ");
  return chapterSummaryFor(item.citation.book, item.chapterNumber) ?? "";
}

/** What the player actually submitted, in the same human-readable shape as
 * correctAnswerText — the post-quiz review shows both side by side for a
 * missed question, not just the correct answer. */
export function userAnswerText(item: QuizItem, answer: Answer): string {
  if (answer.kind === "mc") return "options" in item ? item.options[answer.selectedIndex] : String(answer.selectedIndex);
  if (answer.kind === "chapter-guess") {
    return bookMeta(answer.book)
      ? formatCitation({ book: answer.book, chapter: answer.chapter })
      : `an unrecognized book, chapter ${answer.chapter}`;
  }
  if (answer.kind === "sequence") return answer.order.join(" → ");
  if (answer.kind === "match") return answer.pairs.map((p) => `${p.left} → ${p.right}`).join(", ");
  return answer.text;
}

export interface ScoreResult {
  /** Sum of per-item points — a whole number only when the quiz has no
   * partial credit in play; a close chapter-guess or a partly-right
   * sequence/match makes this fractional (see pointsFor). */
  correct: number;
  /** Sum of each item's maxPointsFor — usually equal to items.length, but
   * higher whenever a sequence/match item is worth more than 1 point. */
  total: number;
  percent: number;
  /** Anything short of full credit — a close chapter-guess or a
   * partly-right sequence/match still belongs in the missed-question bank,
   * since it means the material wasn't fully known. */
  missedIds: string[];
}

export function scoreQuiz(items: QuizItem[], answers: Answer[]): ScoreResult {
  const answerById = new Map(answers.map((a) => [a.itemId, a]));
  let correct = 0;
  let total = 0;
  const missedIds: string[] = [];
  for (const item of items) {
    const answer = answerById.get(item.id);
    const points = answer ? pointsFor(item, answer) : 0;
    const max = maxPointsFor(item);
    correct += points;
    total += max;
    if (points < max) missedIds.push(item.id);
  }
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0, missedIds };
}

/** Default `gapReport` categorizer for a quiz that spans several books (there's no
 * single book's arcs to group by) — falls back to the raw id if a book somehow isn't
 * registered, same graceful-degradation pattern as formatCitation. */
export function categorizeByBook(item: QuizItem): string {
  return bookMeta(item.citation.book)?.name ?? item.citation.book;
}

/** Per-category right/wrong breakdown — what the Quiz's "where to focus" report renders.
 * `categorize` groups items by whatever's useful at the quiz's scope (an arc name for a
 * single-book quiz, a book name for a whole-Bible one — see QuizRunner's `categorize`
 * prop). Less-than-full credit counts as "wrong" here — this is a coaching signal ("do
 * you know this material"), not the numeric score, so it stays binary even though
 * pointsFor itself is fractional. */
export function gapReport(
  items: QuizItem[],
  answers: Answer[],
  categorize: (item: QuizItem) => string
): Record<string, { right: number; wrong: number; percent: number }> {
  const answerById = new Map(answers.map((a) => [a.itemId, a]));
  const stats: Record<string, { right: number; wrong: number }> = {};
  for (const item of items) {
    const cat = categorize(item);
    stats[cat] ??= { right: 0, wrong: 0 };
    const answer = answerById.get(item.id);
    const points = answer ? pointsFor(item, answer) : 0;
    if (points >= maxPointsFor(item)) stats[cat].right++;
    else stats[cat].wrong++;
  }
  const out: Record<string, { right: number; wrong: number; percent: number }> = {};
  for (const [cat, { right, wrong }] of Object.entries(stats)) {
    out[cat] = { right, wrong, percent: Math.round((right / (right + wrong)) * 100) };
  }
  return out;
}

/** Build a quiz from specific question ids (e.g. the missed-question bank), in the given
 * order, resolving ids against several books' pools at once — a missed question saved
 * from a multi-book quiz can come from any of them. */
export function quizFromIdsMulti(
  sources: { data: BookData; questions: AuthoredQuestion[] }[],
  ids: string[]
): QuizItem[] {
  const generatedPool = sources.flatMap((s) => generateAll(s.data));
  const authoredQuestions = sources.flatMap((s) => s.questions);
  const generatedById = new Map(generatedPool.map((g) => [g.id, g]));
  const authoredById = new Map(authoredQuestions.map((q) => [q.id, q]));

  const items: QuizItem[] = [];
  for (const id of ids) {
    const seed = hashSeed(`practice:${id}`);
    const authored = authoredById.get(id);
    if (authored) {
      items.push(toRuntimeAuthored(authored, seed));
      continue;
    }
    const generated = generatedById.get(id);
    if (!generated) continue;
    if (generated.type === "sequence") items.push(toRuntimeSequence(generated as GeneratedSequence, seed));
    else if (generated.type === "match") items.push(toRuntimeMatch(generated as GeneratedMatch, seed));
    else if (generated.type === "free-response") items.push(toRuntimeFreeResponse(generated as GeneratedFreeResponse));
    else if (generated.type === "chapter-guess") items.push(toRuntimeChapterGuess(generated as GeneratedChapterGuess));
    else items.push(toRuntimeMC(generated as GeneratedMC, seed));
  }
  return items;
}
