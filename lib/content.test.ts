import { test } from "node:test";
import assert from "node:assert/strict";
import { matchBookName } from "./content";

test("matchBookName finds an exact, case-insensitive match", () => {
  assert.equal(matchBookName("genesis")?.id, "genesis");
  assert.equal(matchBookName("GENESIS")?.id, "genesis");
});

test("matchBookName tolerates a small typo on a long name", () => {
  assert.equal(matchBookName("Gensis")?.id, "genesis");
});

test("matchBookName returns undefined for a nonexistent book, not a throw", () => {
  assert.equal(matchBookName("Hezekiahopolis"), undefined);
  assert.equal(matchBookName(""), undefined);
});
