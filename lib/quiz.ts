import type { AuthoredQuestion, Citation } from "../content/schema";
import { mulberry32, hashSeed, shuffle } from "./rng";
import {
  generateAll,
  toRuntimeMC,
  toRuntimeSequence,
  toRuntimeMatch,
  type BookData,
  type GeneratedMC,
  type GeneratedSequence,
  type GeneratedMatch,
  type RuntimeMC,
  type RuntimeSequence,
  type RuntimeMatch,
} from "./generate";

/**
 * The quiz engine: mixes the generated pool with hand-authored thematic
 * questions into one seeded, replayable quiz, and scores the result
 * (including the diagnostic's per-category gap report).
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

export type QuizItem = RuntimeAuthoredMC | RuntimeMC | RuntimeSequence | RuntimeMatch;

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

/** Category bucket used for the diagnostic gap report and progress stats. */
export function categoryOf(item: QuizItem): string {
  return item.kind === "authored" ? `theme:${item.category}` : `mechanic:${item.type}`;
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
  const { seedStr, targetCount, generatedRatio = 0.6 } = opts;

  const generatedPool = generateAll(data);
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
  | { itemId: string; kind: "sequence"; order: string[] }
  | { itemId: string; kind: "match"; pairs: { left: string; right: string }[] };

export function isCorrect(item: QuizItem, answer: Answer): boolean {
  if (item.kind === "authored" || item.type === "chapter" || item.type === "location" || item.type === "speaker" || item.type === "chapter-summary") {
    return answer.kind === "mc" && answer.selectedIndex === item.correctIndex;
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
  return false;
}

export interface ScoreResult {
  correct: number;
  total: number;
  percent: number;
  missedIds: string[];
}

export function scoreQuiz(items: QuizItem[], answers: Answer[]): ScoreResult {
  const answerById = new Map(answers.map((a) => [a.itemId, a]));
  let correct = 0;
  const missedIds: string[] = [];
  for (const item of items) {
    const answer = answerById.get(item.id);
    if (answer && isCorrect(item, answer)) {
      correct++;
    } else {
      missedIds.push(item.id);
    }
  }
  const total = items.length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0, missedIds };
}

/** Per-category right/wrong breakdown — what the diagnostic's gap report renders. */
export function gapReport(items: QuizItem[], answers: Answer[]): Record<string, { right: number; wrong: number; percent: number }> {
  const answerById = new Map(answers.map((a) => [a.itemId, a]));
  const stats: Record<string, { right: number; wrong: number }> = {};
  for (const item of items) {
    const cat = categoryOf(item);
    stats[cat] ??= { right: 0, wrong: 0 };
    const answer = answerById.get(item.id);
    if (answer && isCorrect(item, answer)) stats[cat].right++;
    else stats[cat].wrong++;
  }
  const out: Record<string, { right: number; wrong: number; percent: number }> = {};
  for (const [cat, { right, wrong }] of Object.entries(stats)) {
    out[cat] = { right, wrong, percent: Math.round((right / (right + wrong)) * 100) };
  }
  return out;
}

/** Build a quiz from specific question ids (e.g. the missed-question bank), in the given order. */
export function quizFromIds(data: BookData, authoredQuestions: AuthoredQuestion[], ids: string[]): QuizItem[] {
  const generatedPool = generateAll(data);
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
    else items.push(toRuntimeMC(generated as GeneratedMC, seed));
  }
  return items;
}
