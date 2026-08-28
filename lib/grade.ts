import type { Chapter } from "../content/schema";

/**
 * Fuzzy grader for free-response "what happens in this chapter?" answers.
 * Dependency-light on purpose (see content/schema.ts's Chapter doc): the
 * terms an answer is checked against come straight from the chapter's own
 * `title` + `summary` (stopwords stripped), plus any authored
 * `freeResponseAliases` for a well-known nickname the prose doesn't happen to
 * use — no separately-maintained keyword list to fall out of sync with the
 * text it's describing. Normalize the answer to words, check each term for a
 * hit (exact word match, or a short edit-distance for typo tolerance), and
 * call it correct once `minTerms` distinct terms are covered. No embeddings,
 * no NLP library — this is "does the answer mention the right nouns/verbs",
 * which a small stopword list handles fine for a quiz this size.
 */

/** Common English function words — not meaningful on their own, so they don't
 * count as grading terms even though they show up in every summary. */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "so", "yet", "for", "of", "in", "on", "at", "to",
  "from", "by", "with", "as", "is", "are", "was", "were", "be", "been", "being", "has", "have",
  "had", "do", "does", "did", "will", "would", "shall", "should", "may", "might", "must", "can",
  "could", "he", "she", "it", "they", "his", "her", "its", "their", "him", "them", "who", "whom",
  "whose", "which", "that", "this", "these", "those", "not", "no", "into", "onto", "over", "under",
  "after", "before", "when", "while", "than", "then", "also", "just", "own", "other", "some", "all",
  "each", "every", "any", "one", "two", "three", "s", "t",
]);

/** How many distinct terms a free-text answer must cover to be marked
 * correct, for the common "describe this chapter in your own words" case —
 * the terms come straight from the chapter's own prose (see
 * deriveGradingTerms), so this is a fixed constant rather than something
 * authored per chapter. A chapter with fewer available terms than this just
 * requires all of them. A chapter whose terms are a fixed roster instead of
 * prose keywords (e.g. "name the twelve disciples") sets its own threshold
 * via Chapter.freeResponseMinTerms, since 3-of-many is far too lenient there. */
const MIN_TERMS = 3;

export function normalizeWords(s: string): string[] {
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

/** A typo-tolerant match between one answer word and one term word — exact,
 * or within edit distance 1 for terms long enough that a 1-letter slip
 * still means the same word (short words like "ark" or "sin" must match exactly,
 * or "sin" could match "six"). */
export function wordMatches(word: string, term: string): boolean {
  if (word === term) return true;
  if (term.length < 5) return false;
  if (Math.abs(word.length - term.length) > 1) return false;
  return editDistance(word, term) <= 1;
}

/** A term may be a phrase ("palm sunday") — every word in the phrase must
 * appear somewhere in the answer (order-agnostic). */
function termPresent(answerWords: string[], term: string): boolean {
  const termWords = normalizeWords(term);
  return termWords.every((tw) => answerWords.some((w) => wordMatches(w, tw)));
}

export interface GradingTerms {
  terms: string[];
  minTerms: number;
  /** Significant words from the title alone. A title-only chapter (e.g. "The
   * Good Shepherd") often has fewer than minTerms of its own words, so an
   * answer that's just the title's own phrase (an "I am" statement, a famous
   * one-liner) can't reach minTerms without also naming details from the
   * summary it never claimed. Restating the title is correct on its own. */
  titleTerms: string[];
}

/** Pull the significant (non-stopword) words out of a chapter's title and
 * summary, plus any explicitly authored aliases, and dedupe. This is the
 * single source of truth for free-response grading — nothing to keep in
 * sync by hand, since the terms are the chapter's own prose. */
export function deriveGradingTerms(
  chapter: Pick<Chapter, "title" | "summary" | "freeResponseAliases" | "freeResponseMinTerms">
): GradingTerms {
  const titleTerms = normalizeWords(chapter.title).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const words = [...titleTerms, ...normalizeWords(chapter.summary)].filter(
    (w) => w.length > 2 && !STOPWORDS.has(w)
  );
  const terms = Array.from(new Set([...words, ...chapter.freeResponseAliases]));
  return {
    terms,
    minTerms: chapter.freeResponseMinTerms ?? Math.min(MIN_TERMS, terms.length),
    // Only offered as a shortcut for the default "describe this chapter"
    // threshold. A chapter with an authored freeResponseMinTerms (a fixed
    // roster like "name the twelve disciples") means the title is
    // deliberately *not* an acceptable answer on its own — the terms are the
    // roster, not a paraphrase target.
    titleTerms: chapter.freeResponseMinTerms === undefined ? titleTerms : [],
  };
}

export interface GradeResult {
  correct: boolean;
  matchedTerms: number;
  totalTerms: number;
}

export function gradeFreeResponse(grading: GradingTerms, rawAnswer: string): GradeResult {
  const totalTerms = grading.terms.length;
  const text = rawAnswer.trim();
  if (!text) return { correct: false, matchedTerms: 0, totalTerms };

  const answerWords = normalizeWords(text);
  const matchedTerms = grading.terms.filter((term) => termPresent(answerWords, term)).length;
  const restatesTitle =
    grading.titleTerms.length > 0 && grading.titleTerms.every((t) => termPresent(answerWords, t));
  return { correct: matchedTerms >= grading.minTerms || restatesTitle, matchedTerms, totalTerms };
}
