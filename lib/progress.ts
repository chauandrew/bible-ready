"use client";

/**
 * localStorage-backed progress: session scores, per-module best score, the
 * missed-question bank (feeds "practice your misses"), and category stats
 * (feeds the Quiz's "where to focus" report and improves as ordinary quizzes are taken).
 *
 * A corrupt or absent value must never white-screen the app — every read
 * falls back to an empty state.
 */

const STORAGE_KEY = "bible-ready:progress:v1";

export interface Session {
  moduleId: string;
  timestamp: number;
  correct: number;
  total: number;
  percent: number;
}

export interface ProgressState {
  v: 1;
  sessions: Session[];
  best: Record<string, number>; // moduleId -> best percent
  missed: string[]; // question ids, deduped
  categoryStats: Record<string, { right: number; wrong: number }>;
}

function isPlainObject(v: unknown): v is Record<string, never> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function emptyState(): ProgressState {
  return { v: 1, sessions: [], best: {}, missed: [], categoryStats: {} };
}

export function loadProgress(): ProgressState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (parsed?.v !== 1) return emptyState();
    // Spreading a v1-shaped but corrupt payload straight in was enough to
    // white-screen the app: `sessions: "x"` survives the version check and then
    // throws on the first .push(). Take each field only if it has the right shape.
    const empty = emptyState();
    return {
      v: 1,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : empty.sessions,
      best: isPlainObject(parsed.best) ? parsed.best : empty.best,
      missed: Array.isArray(parsed.missed) ? parsed.missed.filter((id: unknown) => typeof id === "string") : empty.missed,
      categoryStats: isPlainObject(parsed.categoryStats) ? parsed.categoryStats : empty.categoryStats,
    };
  } catch {
    return emptyState();
  }
}

function saveProgress(state: ProgressState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable — progress just won't persist this time
  }
}

export function recordSession(
  moduleId: string,
  score: { correct: number; total: number; percent: number },
  missedIds: string[],
  categoryDelta: Record<string, { right: number; wrong: number }>
): ProgressState {
  const state = loadProgress();
  state.sessions.push({ moduleId, timestamp: Date.now(), ...score });
  state.best[moduleId] = Math.max(state.best[moduleId] ?? 0, score.percent);
  state.missed = Array.from(new Set([...state.missed, ...missedIds]));
  for (const [cat, delta] of Object.entries(categoryDelta)) {
    const existing = state.categoryStats[cat] ?? { right: 0, wrong: 0 };
    state.categoryStats[cat] = { right: existing.right + delta.right, wrong: existing.wrong + delta.wrong };
  }
  saveProgress(state);
  return state;
}

/** Call once a previously-missed question is answered correctly, to retire it from the bank. */
export function clearMissed(questionId: string) {
  const state = loadProgress();
  state.missed = state.missed.filter((id) => id !== questionId);
  saveProgress(state);
}

export function clearAllProgress() {
  saveProgress(emptyState());
}
