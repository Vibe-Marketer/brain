import { describe, expect, it } from "vitest";
import {
  FALLBACK_COPY,
  sanitizeReporterSummary,
} from "@/lib/reporter-comms-filter";

describe("sanitizeReporterSummary (default-deny)", () => {
  it("allows clean plain-English summaries", () => {
    const result = sanitizeReporterSummary(
      "This has been fixed and verified in the live app.",
    );
    expect(result.ok).toBe(true);
    expect(result.text).toBe("This has been fixed and verified in the live app.");
    expect(result.redactions).toEqual([]);
  });

  it("rejects file paths", () => {
    const result = sanitizeReporterSummary("Fixed in src/lib/foo.ts:42");
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
    expect(result.redactions).toContain("file_path");
  });

  it("rejects absolute POSIX paths", () => {
    const result = sanitizeReporterSummary("Edited /Users/admin/dev/brain/x.ts");
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
    expect(result.redactions).toContain("file_path");
  });

  it("rejects commit SHAs", () => {
    const result = sanitizeReporterSummary("Merged commit a1b2c3d4e5f6");
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
    expect(result.redactions).toContain("sha");
  });

  it("rejects stack traces", () => {
    const result = sanitizeReporterSummary(
      "TypeError: x is not a function\n  at run (/Users/a/b.ts:1:1)",
    );
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
    expect(result.redactions).toContain("stack_trace");
  });

  it("rejects the banned term 'agent'", () => {
    const result = sanitizeReporterSummary("The agent fixed it");
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
    expect(result.redactions).toContain("banned_term");
  });

  it("rejects the banned term 'Autopilot'", () => {
    const result = sanitizeReporterSummary("Autopilot resolved this");
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
    expect(result.redactions).toContain("banned_term");
  });

  it("rejects code formatting (fences/backticks)", () => {
    const result = sanitizeReporterSummary("```ts\nconst x=1\n```");
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
    expect(result.redactions).toContain("code_formatting");
  });

  it("rejects empty input (allowlist non-empty)", () => {
    const result = sanitizeReporterSummary("");
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
  });

  it("rejects over-length input", () => {
    const result = sanitizeReporterSummary("a".repeat(281));
    expect(result.ok).toBe(false);
    expect(result.text).toBe(FALLBACK_COPY);
  });

  it("returns FALLBACK_COPY exactly on every rejection (no partial leak)", () => {
    const inputs = [
      "Fixed in src/lib/foo.ts:42",
      "Merged commit a1b2c3d4e5f6",
      "TypeError: boom\n  at run (/x/y.ts:1:1)",
      "The agent fixed it",
      "```ts\nx\n```",
      "",
    ];
    for (const input of inputs) {
      const result = sanitizeReporterSummary(input);
      expect(result.ok).toBe(false);
      expect(result.text).toBe(FALLBACK_COPY);
    }
  });
});
