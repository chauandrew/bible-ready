"use client";

/**
 * Question-of-the-day date helper, result shape, and a Phase-1-only local
 * "already answered today" cache. Phase 2 adds Supabase submit/fetch calls
 * to this same file; nothing here talks to the network yet.
 */

export function todayDateStr(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // en-CA locale formats as YYYY-MM-DD
}

export interface QotdResult {
  correct: boolean;
  timeMs: number;
  // percentile fields are undefined in Phase 1 (no backend yet); Phase 2 will populate them
  totalPlayers?: number;
  correctPlayers?: number;
  accuracyPercent?: number;
  speedPercentile?: number | null;
}

const STORAGE_KEY = "bible-ready:qotd:v1";

interface CachedEntry {
  date: string;
  result: QotdResult;
}

export function getCachedResult(dateStr: string): QotdResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry;
    if (parsed?.date !== dateStr) return null;
    return parsed.result;
  } catch {
    return null;
  }
}

export function cacheResult(dateStr: string, result: QotdResult): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CachedEntry = { date: dateStr, result };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // storage full or unavailable — cache just won't persist this time
  }
}
