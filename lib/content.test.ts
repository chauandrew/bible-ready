import { test } from "node:test";
import assert from "node:assert/strict";
import { matchBookName, leadingNumber } from "./content";
import { wordMatches } from "./grade";

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

// Numbered book pairs (1/2 Timothy, 1/2 Peter, 1/2/3 John...) differ from
// their sibling by exactly one character — the leading digit — which is
// within wordMatches's edit-distance-1 typo tolerance. Left unguarded, a
// fuzzy match would silently accept "1 timothy" as a "typo" of "2 timothy"
// once the registry has an unpaired numbered book (none does yet, but this
// is the whole reason matchBookName exists — see "2 timothy" in its doc
// comment). leadingNumber is the guard: it must match exactly before
// wordMatches gets a say.
test("wordMatches alone would conflate numbered book siblings (the bug leadingNumber guards against)", () => {
  assert.equal(wordMatches("1 timothy", "2 timothy"), true);
});

test("leadingNumber distinguishes numbered siblings that wordMatches would conflate", () => {
  assert.equal(leadingNumber("1 timothy"), "1");
  assert.equal(leadingNumber("2 timothy"), "2");
  assert.equal(leadingNumber("genesis"), null);
});
