import { test } from "node:test";
import assert from "node:assert/strict";
import { selectQuiz, selectDailyQuestion, scoreQuiz, gapReport, correctAnswerText, pointsFor, isCorrect, type Answer, type QuizItem } from "./quiz";
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

  const score = scoreQuiz(items, answers);
  assert.equal(score.total, 5);
  assert.equal(score.correct, 4);
  assert.equal(score.percent, 80);
  assert.equal(score.missedIds.length, 1);

  const report = gapReport(items, answers);
  const totalRight = Object.values(report).reduce((sum, r) => sum + r.right, 0);
  const totalWrong = Object.values(report).reduce((sum, r) => sum + r.wrong, 0);
  assert.equal(totalRight, 4);
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
