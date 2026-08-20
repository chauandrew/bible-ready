/**
 * Deterministic seeded PRNG (mulberry32). Same seed -> same sequence, forever,
 * across processes. This is what makes a quiz URL's ?s= seed replayable and
 * what lets check:content enumerate the generator's output deterministically.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string seed (e.g. from a URL query param) to a 32-bit int for mulberry32. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates shuffle using a supplied RNG, non-mutating. */
export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick n distinct items from arr (excluding any in `exclude`) using rand. */
export function pickN<T>(arr: T[], n: number, rand: () => number, exclude: T[] = []): T[] {
  const pool = arr.filter((x) => !exclude.includes(x));
  return shuffle(pool, rand).slice(0, n);
}
