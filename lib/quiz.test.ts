import { test } from "node:test";
import assert from "node:assert/strict";
import { selectQuiz, selectDailyQuestion, scoreQuiz, gapReport, correctAnswerText, userAnswerText, pointsFor, maxPointsFor, isCorrect, type Answer, type QuizItem } from "./quiz";
import type { BookData } from "./generate";
import type { AuthoredQuestion } from "../content/schema";

function fixtureData(): BookData {
  return {
    book: { id: "genesis", name: "Genesis" },
    arcs: [{ id: "creation", book: "genesis", name: "Creation", startChapter: 1, endChapter: 5, summary: "s" }],
    chapters: [1, 2, 3, 4, 5].map((n) => ({
      id: `gen-${n}`,
      book: "genesis",
      number: n,
      title: `Chapter ${n} title`,
      summary: "s",
      arcId: "creation",
      eventIds: [],
      quizWorthy: false,
      freeResponseAliases: [],
    })),
    people: [{ id: "adam", name: "Adam", summary: "s", firstAppearance: { book: "genesis", chapter: 1 }, relations: [] }],
    events: [1, 2, 3, 4, 5].map((n) => ({
      id: `e${n}`,
      book: "genesis",
      chapter: n,
      name: `Event number ${n}`,
      citation: { book: "genesis", chapter: n },
      place: `place-${n}`,
      peopleIds: ["adam"],
      order: 0,
      summary: "s",
      notable: true,
    })),
    quotes: [{ id: "q1", book: "genesis", chapter: 1, verse: 1, speakerId: "adam", text: "hello", citation: { book: "genesis", chapter: 1, verses: "1" } }],
  };
}

const authored: AuthoredQuestion[] = [
  {
    id: "a1",
    book: "genesis",
    category: "theme",
    prompt: "What is the theme?",
    options: ["Grace", "Law", "Wrath", "Silence"],
    correctIndex: 0,
    citation: { book: "genesis", chapter: 1 },
  },
];

test("selectQuiz with the same seed produces an identical question sequence", () => {
  const data = fixtureData();
  const a = selectQuiz(data, authored, { seedStr: "replay-seed", targetCount: 5 });
  const b = selectQuiz(data, authored, { seedStr: "replay-seed", targetCount: 5 });
  assert.deepEqual(a.map((i) => i.id), b.map((i) => i.id));
  assert.deepEqual(a, b);
});

test("selectQuiz falls back to generated-only when authored pool is empty", () => {
  const data = fixtureData();
  const items = selectQuiz(data, [], { seedStr: "no-authored", targetCount: 5 });
  assert.equal(items.length, 5);
  assert.ok(items.every((i) => i.kind === "generated"));
});

test("scoreQuiz and gapReport produce expected percentages for a known answer key", () => {
  const data = fixtureData();
  const items = selectQuiz(data, authored, { seedStr: "score-test", targetCount: 5 });

  // Answer everything correctly except deliberately miss one MC item.
  let missedOne = false;
  const answers: Answer[] = items.map((item) => {
    if (item.kind === "authored" || item.type === "location" || item.type === "speaker" || item.type === "chapter-summary") {
      if (!missedOne) {
        missedOne = true;
        return { itemId: item.id, kind: "mc", selectedIndex: (item.correctIndex + 1) % item.options.length };
      }
      return { itemId: item.id, kind: "mc", selectedIndex: item.correctIndex };
    }
    if (item.type === "chapter-guess") return { itemId: item.id, kind: "chapter-guess", book: item.citation.book, chapter: item.correctChapter };
    if (item.type === "sequence") return { itemId: item.id, kind: "sequence", order: item.correctOrder };
    if (item.type === "match") return { itemId: item.id, kind: "match", pairs: item.correctPairs };
    throw new Error(`unexpected item type in test fixture: ${item.id}`);
  });

  // Every item except the one deliberately-wrong MC item is answered fully
  // correctly (chapter-guess exact, sequence/match answers are the item's
  // own correctOrder/correctPairs), so the shortfall is exactly one MC
  // item's worth of points (1) — total itself varies with the item mix,
  // since a sequence/match item is worth more than 1 (see maxPointsFor).
  const score = scoreQuiz(items, answers);
  assert.equal(score.correct, score.total - 1);
  assert.equal(score.percent, Math.round(((score.total - 1) / score.total) * 100));
  assert.equal(score.missedIds.length, 1);

  const report = gapReport(items, answers, () => "all");
  const totalRight = Object.values(report).reduce((sum, r) => sum + r.right, 0);
  const totalWrong = Object.values(report).reduce((sum, r) => sum + r.wrong, 0);
  assert.equal(totalRight, items.length - 1);
  assert.equal(totalWrong, 1);
});

test("correctAnswerText reads the right field per item type", () => {
  const data = fixtureData();
  const items = selectQuiz(data, authored, { seedStr: "correct-text-test", targetCount: 5 });
  for (const item of items) {
    const text = correctAnswerText(item);
    assert.ok(text.length > 0, `expected non-empty correct-answer text for ${item.id}`);
    if ("correctIndex" in item) assert.equal(text, item.options[item.correctIndex]);
    else if ("correctOrder" in item) assert.equal(text, item.correctOrder.join(" → "));
    else if ("correctPairs" in item) {
      assert.equal(text, item.correctPairs.map((p) => `${p.left} → ${p.right}`).join(", "));
    }
  }
});

test("userAnswerText reads the player's own submission per answer kind", () => {
  const mc: QuizItem = {
    kind: "generated", id: "gen:location:e1", type: "location",
    prompt: "p", options: ["A", "B", "C", "D"], correctIndex: 0,
    citation: { book: "genesis", chapter: 1 },
  };
  assert.equal(userAnswerText(mc, { itemId: mc.id, kind: "mc", selectedIndex: 2 }), "C");

  const guess: QuizItem = {
    kind: "generated", id: "gen:chapter:e1", type: "chapter-guess",
    prompt: "p", correctChapter: 5, citation: { book: "genesis", chapter: 5 },
  };
  assert.equal(
    userAnswerText(guess, { itemId: guess.id, kind: "chapter-guess", book: "genesis", chapter: 3 }),
    "Genesis 3"
  );
  assert.match(
    userAnswerText(guess, { itemId: guess.id, kind: "chapter-guess", book: "", chapter: 3 }),
    /unrecognized book/
  );

  const seq: QuizItem = {
    kind: "generated", id: "gen:sequence:a", type: "sequence",
    prompt: "p", displayItems: ["A", "B"], correctOrder: ["A", "B"], citation: { book: "genesis", chapter: 1 },
  };
  assert.equal(userAnswerText(seq, { itemId: seq.id, kind: "sequence", order: ["B", "A"] }), "B → A");

  const fr: QuizItem = {
    kind: "generated", id: "gen:free-response:c1", type: "free-response",
    prompt: "p", chapterNumber: 1, terms: ["a"], minTerms: 1, citation: { book: "genesis", chapter: 1 },
  };
  assert.equal(userAnswerText(fr, { itemId: fr.id, kind: "free-response", text: "my answer" }), "my answer");
});

test("selectDailyQuestion with the same date produces the same item", () => {
  const data = fixtureData();
  const sources = [{ data, questions: authored }];
  const a = selectDailyQuestion(sources, "2026-08-20");
  const b = selectDailyQuestion(sources, "2026-08-20");
  assert.equal(a.id, b.id);
  assert.deepEqual(a, b);
});

test("selectDailyQuestion varies across dates", () => {
  const data = fixtureData();
  const sources = [{ data, questions: authored }];
  const first = selectDailyQuestion(sources, "2026-08-20");
  const dates = ["2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25"];
  const sawDifferent = dates.some((d) => selectDailyQuestion(sources, d).id !== first.id);
  assert.ok(sawDifferent, "expected at least one different date to pick a different item");
});

test("selectDailyQuestion always returns a valid item, never undefined via the modulo index", () => {
  const data = fixtureData();
  const sources = [{ data, questions: authored }];
  for (const d of ["2026-01-01", "2026-06-15", "2026-12-31", "2026-08-20"]) {
    const item = selectDailyQuestion(sources, d);
    // item.id would throw on undefined if the modulo index picked an out-of-range slot.
    assert.ok(item && typeof item.id === "string" && item.id.length > 0);
  }
});

test("pointsFor gives a chapter-guess half credit for a right-book, one-chapter-off guess", () => {
  const item: QuizItem = {
    kind: "generated",
    id: "gen:chapter:e1",
    type: "chapter-guess",
    prompt: "In which book and chapter does this happen: test event?",
    correctChapter: 5,
    citation: { book: "genesis", chapter: 5 },
  };

  const exact: Answer = { itemId: item.id, kind: "chapter-guess", book: "genesis", chapter: 5 };
  const oneOver: Answer = { itemId: item.id, kind: "chapter-guess", book: "genesis", chapter: 6 };
  const oneUnder: Answer = { itemId: item.id, kind: "chapter-guess", book: "genesis", chapter: 4 };
  const twoOff: Answer = { itemId: item.id, kind: "chapter-guess", book: "genesis", chapter: 7 };
  const rightChapterWrongBook: Answer = { itemId: item.id, kind: "chapter-guess", book: "exodus", chapter: 5 };

  assert.equal(pointsFor(item, exact), 1);
  assert.equal(isCorrect(item, exact), true);

  assert.equal(pointsFor(item, oneOver), 0.5);
  assert.equal(pointsFor(item, oneUnder), 0.5);
  assert.equal(isCorrect(item, oneOver), false); // half credit isn't full credit

  assert.equal(pointsFor(item, twoOff), 0);
  // A near miss on chapter numbering only counts within the same book — being
  // one chapter off in a different book isn't "close", it's just wrong.
  assert.equal(pointsFor(item, rightChapterWrongBook), 0);
});

test("pointsFor gives a sequence question 0.5 per correctly-placed position, uncapped past 1 point", () => {
  const item: QuizItem = {
    kind: "generated",
    id: "gen:sequence:arc1",
    type: "sequence",
    prompt: "Put these in order.",
    displayItems: ["A", "B", "C", "D", "E", "F"],
    correctOrder: ["A", "B", "C", "D", "E", "F"],
    citation: { book: "genesis", chapter: 1 },
  };
  assert.equal(maxPointsFor(item), 3); // 6 options * 0.5

  const allCorrect: Answer = { itemId: item.id, kind: "sequence", order: ["A", "B", "C", "D", "E", "F"] };
  assert.equal(pointsFor(item, allCorrect), 3);
  assert.equal(isCorrect(item, allCorrect), true);

  // 3 of 6 in their right spot (positions 0, 2, 4 -> A, C, E) -> 3 * 0.5 =
  // 1.5, matching the "6 options, 3 correct -> 1.5 points" example.
  const halfCorrect: Answer = { itemId: item.id, kind: "sequence", order: ["A", "D", "C", "F", "E", "B"] };
  assert.equal(pointsFor(item, halfCorrect), 1.5);
  assert.equal(isCorrect(item, halfCorrect), false);

  const noneCorrect: Answer = { itemId: item.id, kind: "sequence", order: ["F", "E", "D", "C", "B", "A"] };
  assert.equal(pointsFor(item, noneCorrect), 0);
});

test("pointsFor gives a match question 0.5 per correctly-matched pair, uncapped past 1 point", () => {
  const item: QuizItem = {
    kind: "generated",
    id: "gen:match:arc1",
    type: "match",
    prompt: "Match each event to where it happens.",
    lefts: ["A", "B", "C", "D"],
    rights: ["W", "X", "Y", "Z"],
    correctPairs: [
      { left: "A", right: "W" },
      { left: "B", right: "X" },
      { left: "C", right: "Y" },
      { left: "D", right: "Z" },
    ],
    citation: { book: "genesis", chapter: 1 },
  };
  assert.equal(maxPointsFor(item), 2); // 4 pairs * 0.5

  const twoRight: Answer = {
    itemId: item.id,
    kind: "match",
    pairs: [
      { left: "A", right: "W" },
      { left: "B", right: "X" },
      { left: "C", right: "Z" }, // wrong
      { left: "D", right: "Y" }, // wrong
    ],
  };
  assert.equal(pointsFor(item, twoRight), 1);
  assert.equal(isCorrect(item, twoRight), false);
});

test("gapReport buckets by whatever categorize returns, not a fixed mechanic/theme key", () => {
  const data = fixtureData();
  const items = selectQuiz(data, authored, { seedStr: "categorize-test", targetCount: 5 });
  const answers: Answer[] = []; // everything unanswered -> every item is "wrong"
  const report = gapReport(items, answers, () => "Everything");
  assert.deepEqual(Object.keys(report), ["Everything"]);
  assert.equal(report["Everything"].wrong, items.length);
});
