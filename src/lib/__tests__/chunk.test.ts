import { describe, expect, it } from "vitest";

import { chunkArray, IN_FILTER_CHUNK_SIZE } from "@/lib/chunk";

describe("chunkArray", () => {
  it("splits an array into chunks of at most the given size", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when items fit within size", () => {
    expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkArray([], 100)).toEqual([]);
  });

  it("preserves element order across chunks", () => {
    const items = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const chunks = chunkArray(items, 100);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(chunks.flat()).toEqual(items);
  });

  it("throws on a non-positive or non-integer size", () => {
    expect(() => chunkArray([1], 0)).toThrow();
    expect(() => chunkArray([1], -5)).toThrow();
    expect(() => chunkArray([1], 1.5)).toThrow();
  });

  it("exports a default in-filter chunk size of 100", () => {
    expect(IN_FILTER_CHUNK_SIZE).toBe(100);
  });
});
