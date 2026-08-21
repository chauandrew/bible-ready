import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveGradingTerms, gradeFreeResponse } from "./grade";
import { ChapterSchema, type Chapter } from "../content/schema";

// Exercise the grader against real authored data (Genesis 22 and 37) rather
// than a synthetic fixture — this is the thing check-content.ts can't check:
// whether the terms derived from a chapter's own title/summary accept a
// reasonable paraphrase and reject a wrong or empty answer. Parsed through
// the schema (not a raw JSON.parse) so defaults like freeResponseAliases
// fill in the same way they do at runtime.
const chapters: Chapter[] = JSON.parse(
  readFileSync(join(__dirname, "..", "content", "genesis", "chapters.json"), "utf-8")
).map((c: unknown) => ChapterSchema.parse(c));

function grading(number: number) {
  const c = chapters.find((c) => c.number === number);
  if (!c) throw new Error(`fixture chapter ${number} not found`);
  return deriveGradingTerms(c);
}

test("Genesis 22 (Abraham offers Isaac): a close paraphrase scores correct", () => {
  const g = grading(22);
  const result = gradeFreeResponse(g, "Abraham almost sacrifices his son Isaac but an angel stops him");
  assert.equal(result.correct, true);
});

test("Genesis 22: a paraphrase using synonyms still scores correct", () => {
  const g = grading(22);
  const result = gradeFreeResponse(g, "God tests Abraham by having him nearly kill his son");
  assert.equal(result.correct, true);
});

test("Genesis 22: an unrelated answer does not score correct", () => {
  const g = grading(22);
  const result = gradeFreeResponse(g, "Noah builds a boat and it rains for forty days");
  assert.equal(result.correct, false);
});

test("Genesis 22: an empty answer never scores correct", () => {
  const g = grading(22);
  assert.equal(gradeFreeResponse(g, "").correct, false);
  assert.equal(gradeFreeResponse(g, "   ").correct, false);
});

test("Genesis 37 (Joseph sold into slavery): a close paraphrase scores correct", () => {
  const g = grading(37);
  const result = gradeFreeResponse(g, "Joseph's jealous brothers sell him as a slave to traders headed to Egypt");
  assert.equal(result.correct, true);
});

test("Genesis 37: a single matched concept alone is not enough", () => {
  const g = grading(37);
  // Only names Joseph and brothers — no action/object term from the
  // chapter's own title or summary — should not clear minTerms.
  const result = gradeFreeResponse(g, "Joseph is proud and arrogant with his brothers");
  assert.equal(result.matchedTerms < g.minTerms, true);
  assert.equal(result.correct, false);
});

test("typo tolerance: a one-letter slip on a long keyword still matches", () => {
  const g = grading(22);
  // "sacrifise" (typo) instead of "sacrifice"
  const result = gradeFreeResponse(g, "Abraham is told to sacrifise his son Isaac");
  assert.equal(result.correct, true);
});

test("deriveGradingTerms pulls in an alias not present in title or summary", () => {
  const terms = deriveGradingTerms({
    title: "The Triumphal Entry",
    summary: "Crowds hail Jesus as king when he rides into the city on a donkey.",
    freeResponseAliases: ["palm sunday"],
  });
  assert.ok(terms.terms.includes("palm sunday"));
  const result = gradeFreeResponse(terms, "It's Palm Sunday, when Jesus enters Jerusalem");
  assert.equal(result.correct, false); // "jerusalem" alone isn't a derived term here
  assert.ok(result.matchedTerms >= 1); // but "palm sunday" and "jesus" do match
});
