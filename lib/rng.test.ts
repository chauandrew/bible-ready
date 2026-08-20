import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32, hashSeed, shuffle, pickN } from "./rng";

test("mulberry32 is deterministic for a given seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test("hashSeed is stable for the same string", () => {
  assert.equal(hashSeed("genesis-arcs"), hashSeed("genesis-arcs"));
  assert.notEqual(hashSeed("a"), hashSeed("b"));
});

test("shuffle with the same seed reproduces the same order", () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  const seed = hashSeed("replay-me");
  const first = shuffle(arr, mulberry32(seed));
  const second = shuffle(arr, mulberry32(seed));
  assert.deepEqual(first, second);
  assert.deepEqual([...first].sort(), arr);
});

test("pickN excludes the given items and returns distinct entries", () => {
  const arr = ["a", "b", "c", "d", "e"];
  const rand = mulberry32(7);
  const picked = pickN(arr, 3, rand, ["a"]);
  assert.equal(picked.length, 3);
  assert.ok(!picked.includes("a"));
  assert.equal(new Set(picked).size, 3);
});
