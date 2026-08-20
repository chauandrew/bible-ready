import { test } from "node:test";
import assert from "node:assert/strict";
import { todayDateStr, getCachedResult, cacheResult, type QotdResult } from "./dailyQuestion";

test("todayDateStr formats a UTC midday date as the same Pacific calendar day", () => {
  assert.equal(todayDateStr(new Date("2026-08-20T18:00:00Z")), "2026-08-20");
});

test("todayDateStr converts a UTC timestamp that is still the previous day in Pacific time", () => {
  // 2026-01-01T05:00:00Z is 2025-12-31T21:00:00 in Pacific time (UTC-8 in January).
  assert.equal(todayDateStr(new Date("2026-01-01T05:00:00Z")), "2025-12-31");
});

test("todayDateStr formats a date that is still the same day early in UTC morning Pacific", () => {
  // 2026-07-04T04:00:00Z is 2026-07-03T21:00:00 in Pacific time (UTC-7 in July, DST).
  assert.equal(todayDateStr(new Date("2026-07-04T04:00:00Z")), "2026-07-03");
});

// No test file in this repo mocks localStorage/window yet (checked lib/progress.test.ts:
// there isn't one). Shim just enough here rather than pulling in a testing library.
function withFakeLocalStorage(fn: () => void) {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  const g = globalThis as { window?: unknown };
  const originalWindow = g.window;
  g.window = { localStorage: fakeLocalStorage };
  try {
    fn();
  } finally {
    g.window = originalWindow;
  }
}

test("cacheResult/getCachedResult round-trip for a matching date, null for a different date", () => {
  withFakeLocalStorage(() => {
    const result: QotdResult = { correct: true, timeMs: 4200 };
    cacheResult("2026-08-20", result);
    assert.deepEqual(getCachedResult("2026-08-20"), result);
    assert.equal(getCachedResult("2026-08-21"), null);
  });
});
