import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAll, findAmbiguities, toRuntimeMC, type BookData, type GeneratedMC } from "./generate";
import { hashSeed } from "./rng";

// Five chapters in one arc, distinct titles/places/names throughout, so every
// generated item's same-arc distractor pool has >=3 options — representative
// of a real corpus (50 chapters), unlike a two-chapter fixture would be.
function fixture(): BookData {
  return {
    book: { id: "genesis", name: "Genesis" },
    arcs: [{ id: "creation", book: "genesis", name: "Creation", startChapter: 1, endChapter: 5, summary: "s" }],
    chapters: [
      { id: "gen-1", book: "genesis", number: 1, title: "Creation of the world", summary: "s", arcId: "creation", eventIds: [] },
      { id: "gen-2", book: "genesis", number: 2, title: "The garden of Eden", summary: "s", arcId: "creation", eventIds: [] },
      { id: "gen-3", book: "genesis", number: 3, title: "The fall of man", summary: "s", arcId: "creation", eventIds: [] },
      { id: "gen-4", book: "genesis", number: 4, title: "Cain and Abel", summary: "s", arcId: "creation", eventIds: [] },
      { id: "gen-5", book: "genesis", number: 5, title: "The line of Adam", summary: "s", arcId: "creation", eventIds: [] },
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
  assert.ok(items.some((i) => i.type === "chapter"));
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
