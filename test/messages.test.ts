import { describe, expect, it } from "vitest";
import MESSAGES from "../data/messages.json";

// Keep tests deterministic and lightweight.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function pickRandom<T>(arr: readonly T[], rnd: () => number): T {
  const idx = Math.floor(rnd() * arr.length);
  return arr[Math.min(arr.length - 1, Math.max(0, idx))];
}

describe("message library", () => {
  it("has categories with safe + spicy pools", () => {
    for (const [_cat, bank] of Object.entries(MESSAGES.categories)) {
      expect(bank).toBeTruthy();
      expect(Array.isArray((bank as any).safe)).toBe(true);
      expect(Array.isArray((bank as any).spicy)).toBe(true);

      // Safe should be well-populated
      expect((bank as any).safe.length).toBeGreaterThanOrEqual(10);
      // Spicy should also be usable
      expect((bank as any).spicy.length).toBeGreaterThanOrEqual(10);

      // No empty strings
      expect((bank as any).safe.every((x: string) => typeof x === "string" && x.trim().length > 0)).toBe(true);
      expect((bank as any).spicy.every((x: string) => typeof x === "string" && x.trim().length > 0)).toBe(true);
    }
  });

  it("seeded selection is deterministic", () => {
    const seed = 123456;
    const rnd = mulberry32(seed);
    const a = pickRandom((MESSAGES.categories as any).general.safe, rnd);

    const rnd2 = mulberry32(seed);
    const b = pickRandom((MESSAGES.categories as any).general.safe, rnd2);

    expect(a).toBe(b);
  });
});
