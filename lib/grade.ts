import type { ChapterGrading } from "../content/schema";

/**
 * Fuzzy grader for free-response "what happens in this chapter?" answers.
 * Dependency-light on purpose (see content/schema.ts's ChapterGrading doc):
 * normalize the answer to words, check each keyword group for a hit (exact
 * word match, or a short edit-distance for typo tolerance), and call it
 * correct once `minGroups` groups are covered. No embeddings, no NLP library —
 * this is "does the answer mention the right nouns/verbs", which a small
 * synonym list handles fine for a quiz this size.
 */

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Classic DP edit distance, fine at word length (never more than ~15 chars here). */
function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** A typo-tolerant match between one answer word and one keyword word — exact,
 * or within edit distance 1 for keywords long enough that a 1-letter slip
 * still means the same word (short words like "ark" or "sin" must match exactly,
 * or "sin" could match "six"). */
function wordMatches(word: string, keyword: string): boolean {
  if (word === keyword) return true;
  if (keyword.length < 5) return false;
  if (Math.abs(word.length - keyword.length) > 1) return false;
  return editDistance(word, keyword) <= 1;
}

/** A keyword may be a phrase ("sold into slavery") — every word in the phrase
 * must appear somewhere in the answer (order-agnostic). */
function keywordPresent(answerWords: string[], keyword: string): boolean {
  const keywordWords = normalizeWords(keyword);
  return keywordWords.every((kw) => answerWords.some((w) => wordMatches(w, kw)));
}

export interface GradeResult {
  correct: boolean;
  matchedGroups: number;
  totalGroups: number;
}

export function gradeFreeResponse(grading: ChapterGrading, rawAnswer: string): GradeResult {
  const totalGroups = grading.keywordGroups.length;
  const text = rawAnswer.trim();
  if (!text) return { correct: false, matchedGroups: 0, totalGroups };

  const answerWords = normalizeWords(text);
  let matchedGroups = 0;
  for (const group of grading.keywordGroups) {
    if (group.some((keyword) => keywordPresent(answerWords, keyword))) matchedGroups++;
  }
  return { correct: matchedGroups >= grading.minGroups, matchedGroups, totalGroups };
}
