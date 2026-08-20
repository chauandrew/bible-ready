import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gradeFreeResponse } from "./grade";
import type { Chapter } from "../content/schema";

// Exercise the grader against real authored data (Genesis 22 and 37) rather
// than a synthetic fixture — this is the thing check-content.ts can't check:
// whether the keyword groups an editor actually wrote accept a reasonable
// paraphrase and reject a wrong or empty answer.
const chapters: Chapter[] = JSON.parse(
  readFileSync(join(__dirname, "..", "content", "genesis", "chapters.json"), "utf-8")
);

function chapter(number: number): Chapter {
  const c = chapters.find((c) => c.number === number);
  if (!c) throw new Error(`fixture chapter ${number} not found`);
  if (!c.freeResponse) throw new Error(`chapter ${number} has no freeResponse grading data`);
  return c;
}

test("Genesis 22 (Abraham offers Isaac): a close paraphrase scores correct", () => {
  const c = chapter(22);
  const result = gradeFreeResponse(c.freeResponse!, "Abraham almost sacrifices his son Isaac but an angel stops him");
  assert.equal(result.correct, true);
});

test("Genesis 22: a paraphrase using synonyms still scores correct", () => {
  const c = chapter(22);
  const result = gradeFreeResponse(c.freeResponse!, "God tests Abraham by having him nearly kill his son");
  assert.equal(result.correct, true);
});

test("Genesis 22: an unrelated answer does not score correct", () => {
  const c = chapter(22);
  const result = gradeFreeResponse(c.freeResponse!, "Noah builds a boat and it rains for forty days");
  assert.equal(result.correct, false);
});

test("Genesis 22: an empty answer never scores correct", () => {
  const c = chapter(22);
  assert.equal(gradeFreeResponse(c.freeResponse!, "").correct, false);
  assert.equal(gradeFreeResponse(c.freeResponse!, "   ").correct, false);
});

test("Genesis 37 (Joseph sold into slavery): a close paraphrase scores correct", () => {
  const c = chapter(37);
  const result = gradeFreeResponse(c.freeResponse!, "Joseph's jealous brothers sell him as a slave to traders headed to Egypt");
  assert.equal(result.correct, true);
});

test("Genesis 37: a single matched concept alone is not enough", () => {
  const c = chapter(37);
  // Only names Joseph — no action, no object/slavery-detail keyword — should
  // not clear minGroups.
  const result = gradeFreeResponse(c.freeResponse!, "Joseph is proud and arrogant with his brothers");
  assert.equal(result.matchedGroups < c.freeResponse!.minGroups, true);
  assert.equal(result.correct, false);
});

test("typo tolerance: a one-letter slip on a long keyword still matches", () => {
  const c = chapter(22);
  // "sacrifise" (typo) instead of "sacrifice"
  const result = gradeFreeResponse(c.freeResponse!, "Abraham is told to sacrifise his son Isaac");
  assert.equal(result.correct, true);
});
