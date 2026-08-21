import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAll, generateChapterQuestions, generateSequenceQuestions, findAmbiguities, toRuntimeMC, type BookData, type GeneratedMC } from "./generate";
import { hashSeed } from "./rng";

// Five chapters in one arc, distinct titles/places/names throughout, so every
// generated item's same-arc distractor pool has >=3 options — representative
// of a real corpus (50 chapters), unlike a two-chapter fixture would be.
function fixture(): BookData {
  return {
    book: { id: "genesis", name: "Genesis" },
    arcs: [{ id: "creation", book: "genesis", name: "Creation", startChapter: 1, endChapter: 5, summary: "s" }],
    chapters: [
      { id: "gen-1", book: "genesis", number: 1, title: "Creation of the world", summary: "s", arcId: "creation", eventIds: [], quizWorthy: false, freeResponseAliases: [] },
      { id: "gen-2", book: "genesis", number: 2, title: "The garden of Eden", summary: "s", arcId: "creation", eventIds: [], quizWorthy: false, freeResponseAliases: [] },
      { id: "gen-3", book: "genesis", number: 3, title: "The fall of man", summary: "s", arcId: "creation", eventIds: [], quizWorthy: false, freeResponseAliases: [] },
      { id: "gen-4", book: "genesis", number: 4, title: "Cain and Abel", summary: "s", arcId: "creation", eventIds: [], quizWorthy: false, freeResponseAliases: [] },
      { id: "gen-5", book: "genesis", number: 5, title: "The line of Adam", summary: "s", arcId: "creation", eventIds: [], quizWorthy: false, freeResponseAliases: [] },
    ],
    people: [
      { id: "adam", name: "Adam", summary: "s", firstAppearance: { book: "genesis", chapter: 1 }, relations: [] },
      { id: "eve", name: "Eve", summary: "s", firstAppearance: { book: "genesis", chapter: 2 }, relations: [] },
      { id: "serpent", name: "The serpent", summary: "s", firstAppearance: { book: "genesis", chapter: 3 }, relations: [] },
      { id: "cain", name: "Cain", summary: "s", firstAppearance: { book: "genesis", chapter: 4 }, relations: [] },
      { id: "abel", name: "Abel", summary: "s", firstAppearance: { book: "genesis", chapter: 4 }, relations: [] },
    ],
    events: [
      { id: "e1", book: "genesis", chapter: 1, name: "God creates light", citation: { book: "genesis", chapter: 1 }, place: "the heavens", peopleIds: [], order: 0, summary: "s", notable: true },
      { id: "e2", book: "genesis", chapter: 2, name: "God forms Adam from dust", citation: { book: "genesis", chapter: 2 }, place: "Eden", peopleIds: ["adam"], order: 0, summary: "s", notable: true },
      { id: "e3", book: "genesis", chapter: 3, name: "The serpent tempts Eve", citation: { book: "genesis", chapter: 3 }, place: "the garden", peopleIds: ["eve", "serpent"], order: 0, summary: "s", notable: true },
      { id: "e4", book: "genesis", chapter: 4, name: "Cain kills Abel", citation: { book: "genesis", chapter: 4 }, place: "the field", peopleIds: ["cain", "abel"], order: 0, summary: "s", notable: true },
      { id: "e5", book: "genesis", chapter: 5, name: "Adam fathers Seth", citation: { book: "genesis", chapter: 5 }, place: "east of Eden", peopleIds: ["adam"], order: 0, summary: "s", notable: true },
    ],
    quotes: [
      { id: "q1", book: "genesis", chapter: 2, verse: 23, speakerId: "adam", text: "This at last is bone of my bones", citation: { book: "genesis", chapter: 2, verses: "23" } },
    ],
  };
}

test("generateAll produces at least one item per event/quote/chapter", () => {
  const data = fixture();
  const items = generateAll(data);
  assert.ok(items.some((i) => i.type === "chapter-guess"));
  assert.ok(items.some((i) => i.type === "location"));
  assert.ok(items.some((i) => i.type === "speaker"));
  assert.ok(items.some((i) => i.type === "chapter-summary"));
});

test("a realistically sized clean fixture has no ambiguities", () => {
  assert.deepEqual(findAmbiguities(fixture()), []);
});

test("too few chapters to fill a distractor pool is flagged, not silently shipped", () => {
  const data = fixture();
  data.chapters = data.chapters.slice(0, 2);
  data.events = data.events.slice(0, 2);
  const problems = findAmbiguities(data);
  assert.ok(problems.some((p) => p.reason.includes("distinct distractors")));
});

test("duplicate event names across chapters are flagged as ambiguous", () => {
  const data = fixture();
  data.events[1] = { ...data.events[1], name: "God creates light" }; // collides with e1's name, different chapter
  const problems = findAmbiguities(data);
  assert.ok(problems.some((p) => p.reason.includes("shared across chapters")));
});

test("duplicate order within the same chapter is flagged", () => {
  const data = fixture();
  data.events.push({ ...data.events[1], id: "e2b" }); // same chapter (2) and order (0) as e2
  const problems = findAmbiguities(data);
  assert.ok(problems.some((p) => p.reason.includes("duplicate order")));
});

test("toRuntimeMC with the same seed reproduces the same options and correct index", () => {
  const data = fixture();
  const items = generateAll(data).filter((i): i is GeneratedMC => i.kind === "generated" && "distractorPool" in i);
  const item = items[0];
  const seed = hashSeed("quiz-seed-1");
  const a = toRuntimeMC(item, seed);
  const b = toRuntimeMC(item, seed);
  assert.deepEqual(a.options, b.options);
  assert.equal(a.correctIndex, b.correctIndex);
  assert.equal(a.options[a.correctIndex], item.correctAnswer);
});

test("a scoped module still gets four options, because distractors stay book-wide", () => {
  const data = fixture();
  // A two-chapter arc: on its own it cannot supply three wrong chapters.
  data.arcs.push({ id: "later", book: "genesis", name: "Later", startChapter: 6, endChapter: 7, summary: "s" });
  data.chapters.push(
    { id: "gen-6", book: "genesis", number: 6, title: "Noah builds the ark", summary: "s", arcId: "later", eventIds: [], quizWorthy: false, freeResponseAliases: [] },
    { id: "gen-7", book: "genesis", number: 7, title: "The flood begins", summary: "s", arcId: "later", eventIds: [], quizWorthy: false, freeResponseAliases: [] }
  );
  data.events.push(
    { id: "e6", book: "genesis", chapter: 6, name: "Noah builds the ark", citation: { book: "genesis", chapter: 6 }, peopleIds: [], order: 0, summary: "s", notable: true },
    { id: "e7", book: "genesis", chapter: 7, name: "The flood covers the earth", citation: { book: "genesis", chapter: 7 }, peopleIds: [], order: 0, summary: "s", notable: true }
  );

  const scoped = { ...data, scopeChapters: [6, 7] };
  const items = generateAll(scoped).filter((i): i is GeneratedMC => "distractorPool" in i);
  assert.ok(items.length > 0);
  for (const item of items) {
    assert.ok(item.distractorPool.length >= 3, `${item.id} has only ${item.distractorPool.length} distractors`);
    const runtime = toRuntimeMC(item, hashSeed(item.id));
    assert.equal(runtime.options.length, 4);
    assert.equal(runtime.options[runtime.correctIndex], item.correctAnswer);
  }
  // Scoping restricts what is asked, not where distractors come from.
  assert.deepEqual(findAmbiguities(scoped), []);
  assert.ok(items.every((i) => i.citation.chapter === 6 || i.citation.chapter === 7));
});

test("questions that answer themselves are skipped, not shipped", () => {
  const data = fixture();
  data.events[3] = { ...data.events[3], name: "Cain kills Abel in the field", place: "the field" };
  data.quotes.push({
    id: "q2", book: "genesis", chapter: 4, verse: 9, speakerId: "cain",
    text: "Then Cain said, \"Am I my brother's keeper?\"",
    citation: { book: "genesis", chapter: 4, verses: "9" },
  });

  const items = generateAll(data);
  assert.ok(!items.some((i) => i.id === "gen:location:e4"), "location question leaks its own place");
  assert.ok(!items.some((i) => i.id === "gen:speaker:q2"), "speaker question leaks its own speaker");

  const problems = findAmbiguities(data);
  assert.ok(problems.every((p) => p.severity === "warn"), "self-answering content should warn, not fail");
  assert.equal(problems.filter((p) => p.severity === "warn").length, 2);
});

test("generateChapterQuestions produces a free-response chapter-guess item per notable event, no distractors needed", () => {
  const data = fixture();
  const items = generateChapterQuestions(data);
  assert.equal(items.length, data.events.filter((e) => e.notable).length);
  for (const item of items) {
    assert.equal(item.type, "chapter-guess");
    assert.ok(!("distractorPool" in item), "chapter-guess has no MC options to validate");
    const event = data.events.find((e) => `gen:chapter:${e.id}` === item.id);
    assert.equal(item.correctChapter, event?.chapter);
  }
});

// A hand-curated module like Miscellaneous (Famous 12s) sets book.autoGenerate:
// false since its "chapters" aren't narrative prose the generic per-event/
// per-chapter templates can ask sensible questions about.
function orderingFixture(sequenceLimit?: number): BookData {
  return {
    book: { id: "misc", name: "Misc" },
    arcs: [{ id: "a", book: "misc", name: "A", startChapter: 1, endChapter: 1, summary: "s", sequenceLimit }],
    chapters: [
      { id: "c1", book: "misc", number: 1, title: "t", summary: "s", arcId: "a", eventIds: [], quizWorthy: false, freeResponseAliases: [] },
    ],
    people: [],
    events: Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`, book: "misc", chapter: 1, name: `Book ${i}`, citation: { book: "misc", chapter: 1 },
      peopleIds: [], order: i, summary: "s", notable: true,
    })),
    quotes: [],
  };
}

test("generateSequenceQuestions defaults to a 6-item cap without arc.sequenceLimit", () => {
  const [seq] = generateSequenceQuestions(orderingFixture());
  assert.equal(seq.itemsInOrder.length, 6);
});

test("generateSequenceQuestions honors a higher arc.sequenceLimit", () => {
  const [seq] = generateSequenceQuestions(orderingFixture(8));
  assert.equal(seq.itemsInOrder.length, 8);
});

test("book.autoGenerate: false suppresses chapter-guess/location/speaker/chapter-summary, in generateAll and findAmbiguities alike", () => {
  const data = fixture();
  data.book = { ...data.book, autoGenerate: false };
  const items = generateAll(data);
  for (const type of ["chapter-guess", "location", "speaker", "chapter-summary"] as const) {
    assert.ok(!items.some((i) => i.type === type), `${type} should be suppressed`);
  }
  assert.deepEqual(findAmbiguities(data), [], "no ambiguity checks for question types that are never generated");
});
