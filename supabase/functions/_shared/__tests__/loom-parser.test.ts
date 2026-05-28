import { describe, expect, it } from "vitest";
import {
  extractLoomShareToken,
  isLoomUrl,
  parseLoomTranscript,
} from "../loom-parser";

describe("loom-parser", () => {
  it("detects Loom share URLs", () => {
    expect(isLoomUrl("https://www.loom.com/share/abc123")).toBe(true);
    expect(isLoomUrl("https://loom.com/share/abc123")).toBe(true);
    expect(isLoomUrl("https://loom.com/embed/abc123")).toBe(false);
    expect(isLoomUrl("https://example.com/share/abc123")).toBe(false);
  });

  it("extracts Loom share tokens", () => {
    expect(extractLoomShareToken("https://www.loom.com/share/abc_123-xyz")).toBe("abc_123-xyz");
    expect(extractLoomShareToken("https://www.loom.com/share/abc123?sid=456")).toBe("abc123");
    expect(extractLoomShareToken("https://loom.com/embed/abc123")).toBeNull();
  });

  it("parses timestamped Loom transcript text with Unknown Speaker fallback", () => {
    const parsed = parseLoomTranscript(`0:00
Welcome to the walkthrough.
0:08
Now choose Import Transcript.`);

    expect(parsed.parse_status).toBe("parsed");
    expect(parsed.segments).toEqual([
      {
        start_ms: 0,
        speaker: "Unknown Speaker",
        text: "Welcome to the walkthrough.",
      },
      {
        start_ms: 8000,
        speaker: "Unknown Speaker",
        text: "Now choose Import Transcript.",
      },
    ]);
  });

  it("supports hour timestamps", () => {
    const parsed = parseLoomTranscript(`1:02:03
Long walkthrough section.`);

    expect(parsed.parse_status).toBe("parsed");
    expect(parsed.segments[0]).toMatchObject({
      start_ms: 3723000,
      speaker: "Unknown Speaker",
      text: "Long walkthrough section.",
    });
  });

  it("parses timestamp and transcript text on the same line", () => {
    const parsed = parseLoomTranscript(`0:00 Intro section
0:12 Walk through the import dropdown
1:03 Verify the transcript preview`);

    expect(parsed.parse_status).toBe("parsed");
    expect(parsed.segments).toEqual([
      {
        start_ms: 0,
        speaker: "Unknown Speaker",
        text: "Intro section",
      },
      {
        start_ms: 12000,
        speaker: "Unknown Speaker",
        text: "Walk through the import dropdown",
      },
      {
        start_ms: 63000,
        speaker: "Unknown Speaker",
        text: "Verify the transcript preview",
      },
    ]);
  });

  it("falls back to raw for weak or malformed Loom transcript text", () => {
    expect(parseLoomTranscript("this has no timestamped transcript turns")).toEqual({
      parse_status: "raw",
      segments: [],
    });
    expect(parseLoomTranscript("")).toEqual({
      parse_status: "raw",
      segments: [],
    });
  });
});
