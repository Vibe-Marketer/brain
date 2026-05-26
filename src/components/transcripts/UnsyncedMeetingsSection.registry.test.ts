import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("UnsyncedMeetingsSection connector neutrality", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const source = readFileSync(
    join(repoRoot, "src/components/transcripts/UnsyncedMeetingsSection.tsx"),
    "utf8",
  );

  it("does not expose the stale Fathom-only direct categorize sync callback", () => {
    expect(source).not.toMatch(/onDirectCategorize/);
  });

  it("passes the resolved meeting to row actions so callers keep source context", () => {
    expect(source).toMatch(/onViewCall: \(meeting: Meeting\) => void/);
    expect(source).toMatch(/onDownload: \(meeting: Meeting, title: string\) => void/);
    expect(source).not.toMatch(/onViewCall: \(recordingId: string\)/);
  });
});
