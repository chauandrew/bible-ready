"use client";

/**
 * Question-of-the-day date helper, result shape, a local "already answered
 * today" cache, and the Supabase submit/fetch calls that back the shared
 * daily percentile.
 */

import { getSupabaseClient } from "./supabase";

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
  // Aggregate fields from the qotd_submit_and_score/qotd_my_result RPCs.
  // Absent on a result that's only been computed locally and not yet
  // (or not successfully) submitted to Supabase.
  totalPlayers?: number;
  correctPlayers?: number;
  accuracyPercent?: number;
  speedPercentile?: number | null;
}

/** Thrown when a submit hits the one-response-per-device-per-day unique constraint. */
export class AlreadyPlayedError extends Error {
  constructor() {
    super("Already answered today's question");
    this.name = "AlreadyPlayedError";
  }
}

interface QotdRpcRow {
  correct: boolean;
  time_ms: number;
  total_players: number;
  correct_players: number;
  accuracy_percent: number;
  speed_percentile: number | null;
}

function rowToResult(row: QotdRpcRow): QotdResult {
  return {
    correct: row.correct,
    timeMs: row.time_ms,
    totalPlayers: row.total_players,
    correctPlayers: row.correct_players,
    accuracyPercent: row.accuracy_percent,
    speedPercentile: row.speed_percentile,
  };
}

export async function submitDailyAnswer(args: {
  playDate: string;
  deviceId: string;
  questionId: string;
  correct: boolean;
  timeMs: number;
}): Promise<QotdResult> {
  const { data, error } = await getSupabaseClient().rpc("qotd_submit_and_score", {
    p_play_date: args.playDate,
    p_device_id: args.deviceId,
    p_question_id: args.questionId,
    p_correct: args.correct,
    p_time_ms: args.timeMs,
  });
  if (error) {
    if (error.code === "23505") throw new AlreadyPlayedError();
    throw error;
  }
  const row = (data as QotdRpcRow[] | null)?.[0];
  if (!row) throw new Error("qotd_submit_and_score returned no row");
  return rowToResult(row);
}

export async function fetchMyResult(playDate: string, deviceId: string): Promise<QotdResult | null> {
  const { data, error } = await getSupabaseClient().rpc("qotd_my_result", {
    p_play_date: playDate,
    p_device_id: deviceId,
  });
  if (error) throw error;
  const row = (data as QotdRpcRow[] | null)?.[0];
  return row ? rowToResult(row) : null;
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
