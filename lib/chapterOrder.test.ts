import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreChapterOrder, place, unplace, nextEmptySlot, type Placements } from "./chapterOrder";
import type { Chapter } from "../content/schema";

function fakeChapter(number: number): Chapter {
  return {
    id: `c${number}`,
    book: "genesis",
    number,
    title: `Chapter ${number}`,
    summary: `Summary ${number}`,
    arcId: "arc",
    eventIds: [],
    quizWorthy: false,
    freeResponseAliases: [],
  };
}

const chapters = [fakeChapter(1), fakeChapter(2), fakeChapter(3)];

test("scoreChapterOrder: every chapter in its own slot scores 100%", () => {
  const placements: Placements = { 1: "c1", 2: "c2", 3: "c3" };
  const score = scoreChapterOrder(chapters, placements);
  assert.equal(score.correctCount, 3);
  assert.equal(score.percent, 100);
});

test("scoreChapterOrder: every chapter shifted one slot scores 0%", () => {
  const placements: Placements = { 1: "c2", 2: "c3", 3: "c1" };
  const score = scoreChapterOrder(chapters, placements);
  assert.equal(score.correctCount, 0);
  assert.equal(score.percent, 0);
});

test("scoreChapterOrder: an unplaced chapter counts wrong, not excluded", () => {
  const placements: Placements = { 1: "c1", 2: "c2" };
  const score = scoreChapterOrder(chapters, placements);
  assert.equal(score.correctCount, 2);
  assert.equal(score.total, 3);
  const c3Result = score.results.find((r) => r.chapter.id === "c3");
  assert.equal(c3Result?.placedSlot, null);
  assert.equal(c3Result?.correct, false);
});

test("place: dropping a card onto an occupied slot bumps the old occupant to the pool", () => {
  const placements: Placements = { 1: "c1", 2: "c2" };
  const next = place(placements, "c3", 1);
  assert.equal(next[1], "c3");
  // c1 no longer appears anywhere -> back in the derived pool.
  assert.ok(!Object.values(next).includes("c1"));
});

test("place: moving a card from slot A to slot B clears slot A", () => {
  const placements: Placements = { 1: "c1", 2: null };
  const next = place(placements, "c1", 2);
  assert.equal(next[1], null);
  assert.equal(next[2], "c1");
});

test("unplace: a chapter not placed anywhere is a no-op", () => {
  const placements: Placements = { 1: "c1" };
  const next = unplace(placements, "c2");
  assert.deepEqual(next, placements);
});

test("nextEmptySlot: returns the lowest gap, and null once full", () => {
  assert.equal(nextEmptySlot(chapters, { 1: "c1", 3: "c3" }), 2);
  assert.equal(nextEmptySlot(chapters, { 1: "c1", 2: "c2", 3: "c3" }), null);
});
