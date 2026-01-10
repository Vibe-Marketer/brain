import { describe, it, expect } from "vitest";
import {
  normalizeTag,
  normalizeTags,
  deduplicateTags,
  isValidTag,
  getTagSuggestions,
  addTag,
  removeTag,
  parseTagString,
  tagsToString,
} from "../tag-utils";

describe("normalizeTag", () => {
  it("should convert to lowercase", () => {
    expect(normalizeTag("HELLO")).toBe("hello");
    expect(normalizeTag("HeLLo")).toBe("hello");
    expect(normalizeTag("Hello World")).toBe("hello world");
  });

  it("should trim whitespace", () => {
    expect(normalizeTag("  hello  ")).toBe("hello");
    expect(normalizeTag("\thello\n")).toBe("hello");
    expect(normalizeTag("   ")).toBe(null);
  });

  it("should return null for empty tags", () => {
    expect(normalizeTag("")).toBe(null);
    expect(normalizeTag("   ")).toBe(null);
    expect(normalizeTag("\t\n")).toBe(null);
  });

  it("should return null for non-string inputs", () => {
    expect(normalizeTag(null as unknown as string)).toBe(null);
    expect(normalizeTag(undefined as unknown as string)).toBe(null);
    expect(normalizeTag(123 as unknown as string)).toBe(null);
    expect(normalizeTag({} as unknown as string)).toBe(null);
  });

  it("should preserve hyphens and underscores", () => {
    expect(normalizeTag("follow-up")).toBe("follow-up");
    expect(normalizeTag("follow_up")).toBe("follow_up");
    expect(normalizeTag("FOLLOW-UP")).toBe("follow-up");
  });

  it("should handle special characters", () => {
    expect(normalizeTag("tag#1")).toBe("tag#1");
    expect(normalizeTag("C++")).toBe("c++");
    expect(normalizeTag("@mention")).toBe("@mention");
  });
});

describe("normalizeTags", () => {
  it("should normalize and deduplicate tags", () => {
    const result = normalizeTags(["Hello", "HELLO", "hello"]);
    expect(result).toEqual(["hello"]);
  });

  it("should remove empty tags", () => {
    const result = normalizeTags(["hello", "", "  ", "world"]);
    expect(result).toEqual(["hello", "world"]);
  });

  it("should handle mixed case duplicates", () => {
    const result = normalizeTags(["Follow-Up", "follow-up", "FOLLOW-UP"]);
    expect(result).toEqual(["follow-up"]);
  });

  it("should return empty array for non-array input", () => {
    expect(normalizeTags(null as unknown as string[])).toEqual([]);
    expect(normalizeTags(undefined as unknown as string[])).toEqual([]);
    expect(normalizeTags("hello" as unknown as string[])).toEqual([]);
  });

  it("should return empty array for empty array", () => {
    expect(normalizeTags([])).toEqual([]);
  });

  it("should handle array with only empty strings", () => {
    expect(normalizeTags(["", "  ", "\t"])).toEqual([]);
  });

  it("should preserve order of first occurrence", () => {
    const result = normalizeTags(["apple", "banana", "APPLE", "cherry"]);
    expect(result).toEqual(["apple", "banana", "cherry"]);
  });
});

describe("deduplicateTags", () => {
  it("should remove exact duplicates", () => {
    const result = deduplicateTags(["hello", "world", "hello"]);
    expect(result).toEqual(["hello", "world"]);
  });

  it("should preserve original case (no normalization)", () => {
    const result = deduplicateTags(["Hello", "hello"]);
    expect(result).toEqual(["Hello", "hello"]);
  });

  it("should preserve original order", () => {
    const result = deduplicateTags(["c", "a", "b", "a", "c"]);
    expect(result).toEqual(["c", "a", "b"]);
  });

  it("should return empty array for non-array input", () => {
    expect(deduplicateTags(null as unknown as string[])).toEqual([]);
    expect(deduplicateTags(undefined as unknown as string[])).toEqual([]);
  });

  it("should return empty array for empty array", () => {
    expect(deduplicateTags([])).toEqual([]);
  });

  it("should handle single element", () => {
    expect(deduplicateTags(["only"])).toEqual(["only"]);
  });

  it("should handle all duplicates", () => {
    expect(deduplicateTags(["same", "same", "same"])).toEqual(["same"]);
  });
});

describe("isValidTag", () => {
  it("should return true for valid tags", () => {
    expect(isValidTag("hello")).toBe(true);
    expect(isValidTag("follow-up")).toBe(true);
    expect(isValidTag("tag_name")).toBe(true);
    expect(isValidTag("tag123")).toBe(true);
  });

  it("should return false for empty strings", () => {
    expect(isValidTag("")).toBe(false);
    expect(isValidTag("   ")).toBe(false);
  });

  it("should return false for non-strings", () => {
    expect(isValidTag(null as unknown as string)).toBe(false);
    expect(isValidTag(undefined as unknown as string)).toBe(false);
    expect(isValidTag(123 as unknown as string)).toBe(false);
  });

  it("should return false for tags exceeding max length", () => {
    const longTag = "a".repeat(51);
    expect(isValidTag(longTag)).toBe(false);

    const exactMaxTag = "a".repeat(50);
    expect(isValidTag(exactMaxTag)).toBe(true);
  });
});

describe("getTagSuggestions", () => {
  const existingTags = [
    "javascript",
    "java",
    "python",
    "typescript",
    "react",
    "reactnative",
    "follow-up",
    "meeting",
    "sales",
    "marketing",
  ];

  it("should return tags matching prefix", () => {
    const result = getTagSuggestions("java", existingTags);
    expect(result).toContain("javascript");
    expect(result).not.toContain("python");
  });

  it("should return tags containing substring", () => {
    const result = getTagSuggestions("script", existingTags);
    expect(result).toContain("javascript");
    expect(result).toContain("typescript");
  });

  it("should sort prefix matches before substring matches", () => {
    const result = getTagSuggestions("react", existingTags);
    expect(result[0]).toBe("react");
  });

  it("should sort by length (shorter first)", () => {
    const result = getTagSuggestions("java", existingTags);
    // "java" exact match excluded by default, so "javascript" should be first
    expect(result[0]).toBe("javascript");
  });

  it("should be case-insensitive", () => {
    const result = getTagSuggestions("JAVA", existingTags);
    expect(result).toContain("javascript");
  });

  it("should respect limit option", () => {
    const result = getTagSuggestions("a", existingTags, { limit: 3 });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("should exclude exact match by default", () => {
    const result = getTagSuggestions("java", existingTags);
    expect(result).not.toContain("java");
  });

  it("should include exact match when option set", () => {
    const result = getTagSuggestions("java", existingTags, { includeExact: true });
    expect(result).toContain("java");
  });

  it("should return empty array for empty search", () => {
    expect(getTagSuggestions("", existingTags)).toEqual([]);
    expect(getTagSuggestions("   ", existingTags)).toEqual([]);
  });

  it("should return empty array for non-array existingTags", () => {
    expect(getTagSuggestions("test", null as unknown as string[])).toEqual([]);
    expect(getTagSuggestions("test", undefined as unknown as string[])).toEqual([]);
  });

  it("should handle no matches", () => {
    const result = getTagSuggestions("xyz", existingTags);
    expect(result).toEqual([]);
  });

  it("should normalize existing tags before matching", () => {
    const mixedCaseTags = ["JavaScript", "PYTHON", "React"];
    const result = getTagSuggestions("java", mixedCaseTags);
    expect(result).toContain("javascript");
  });

  it("should deduplicate existing tags", () => {
    const duplicateTags = ["javascript", "JavaScript", "JAVASCRIPT"];
    const result = getTagSuggestions("java", duplicateTags, { includeExact: true });
    expect(result.filter((t) => t === "javascript").length).toBe(1);
  });
});

describe("addTag", () => {
  it("should add a new tag", () => {
    const result = addTag(["hello"], "world");
    expect(result).toContain("world");
    expect(result).toContain("hello");
  });

  it("should normalize the new tag", () => {
    const result = addTag(["hello"], "  WORLD  ");
    expect(result).toContain("world");
  });

  it("should not add duplicate tags (case-insensitive)", () => {
    const result = addTag(["hello", "world"], "HELLO");
    expect(result).toEqual(["hello", "world"]);
  });

  it("should not add empty tags", () => {
    const result = addTag(["hello"], "   ");
    expect(result).toEqual(["hello"]);
  });

  it("should normalize existing tags too", () => {
    const result = addTag(["  HELLO  ", "WORLD"], "new");
    expect(result).toEqual(["hello", "world", "new"]);
  });
});

describe("removeTag", () => {
  it("should remove a tag", () => {
    const result = removeTag(["hello", "world"], "hello");
    expect(result).toEqual(["world"]);
  });

  it("should remove tag case-insensitively", () => {
    const result = removeTag(["Hello", "World"], "HELLO");
    expect(result).toEqual(["World"]);
  });

  it("should handle tag not found", () => {
    const result = removeTag(["hello", "world"], "notfound");
    expect(result).toEqual(["hello", "world"]);
  });

  it("should handle empty tag to remove", () => {
    const result = removeTag(["hello", "world"], "   ");
    expect(result).toEqual(["hello", "world"]);
  });

  it("should remove all matching tags (case-insensitive)", () => {
    const result = removeTag(["Hello", "hello", "HELLO", "world"], "hello");
    expect(result).toEqual(["world"]);
  });
});

describe("parseTagString", () => {
  it("should parse comma-separated tags", () => {
    const result = parseTagString("hello, world, test");
    expect(result).toEqual(["hello", "world", "test"]);
  });

  it("should normalize parsed tags", () => {
    const result = parseTagString("  HELLO  , World , TEST  ");
    expect(result).toEqual(["hello", "world", "test"]);
  });

  it("should deduplicate parsed tags", () => {
    const result = parseTagString("hello, HELLO, Hello");
    expect(result).toEqual(["hello"]);
  });

  it("should skip empty segments", () => {
    const result = parseTagString("hello,,world,  ,test");
    expect(result).toEqual(["hello", "world", "test"]);
  });

  it("should return empty array for empty string", () => {
    expect(parseTagString("")).toEqual([]);
  });

  it("should return empty array for non-string input", () => {
    expect(parseTagString(null as unknown as string)).toEqual([]);
    expect(parseTagString(undefined as unknown as string)).toEqual([]);
  });

  it("should handle single tag", () => {
    expect(parseTagString("single")).toEqual(["single"]);
  });
});

describe("tagsToString", () => {
  it("should convert tags to comma-separated string", () => {
    const result = tagsToString(["hello", "world", "test"]);
    expect(result).toBe("hello, world, test");
  });

  it("should normalize tags in output", () => {
    const result = tagsToString(["  HELLO  ", "World", "TEST"]);
    expect(result).toBe("hello, world, test");
  });

  it("should deduplicate in output", () => {
    const result = tagsToString(["hello", "HELLO", "Hello"]);
    expect(result).toBe("hello");
  });

  it("should return empty string for empty array", () => {
    expect(tagsToString([])).toBe("");
  });

  it("should return empty string for non-array input", () => {
    expect(tagsToString(null as unknown as string[])).toBe("");
    expect(tagsToString(undefined as unknown as string[])).toBe("");
  });

  it("should handle single tag", () => {
    expect(tagsToString(["single"])).toBe("single");
  });
});

describe("Edge Cases", () => {
  it("should handle unicode characters in tags", () => {
    expect(normalizeTag("日本語")).toBe("日本語");
    expect(normalizeTag("ÉMOJI")).toBe("émoji");
    expect(normalizeTag("Привет")).toBe("привет");
  });

  it("should handle very long valid tags at boundary", () => {
    const tag49 = "a".repeat(49);
    const tag50 = "a".repeat(50);
    expect(isValidTag(tag49)).toBe(true);
    expect(isValidTag(tag50)).toBe(true);
  });

  it("should handle special regex characters in search", () => {
    const tags = ["c++", "c#", "regex.*test"];
    const result = getTagSuggestions("c+", tags, { includeExact: true });
    expect(result).toContain("c++");
  });

  it("should handle empty existing tags array in suggestions", () => {
    const result = getTagSuggestions("test", []);
    expect(result).toEqual([]);
  });

  it("should handle tags with only whitespace in array", () => {
    const result = normalizeTags(["  ", "\t", "\n", "valid"]);
    expect(result).toEqual(["valid"]);
  });
});
