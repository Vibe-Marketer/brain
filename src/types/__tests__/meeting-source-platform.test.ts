import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MeetingSourcePlatform } from "@/types/meetings";

const source = readFileSync(join(process.cwd(), "src/types/meetings.ts"), "utf8");

describe("meeting source platform type", () => {
  it("derives meeting source platforms from the source registry", () => {
    expect(source).toMatch(/import type \{ SourceAlias, SourceId \}/);
    expect(source).toMatch(/export type MeetingSourcePlatform = SourceId \| SourceAlias/);
    expect(source).toMatch(/source_platform\?: MeetingSourcePlatform \| null/);
    expect(source).not.toMatch(
      /source_platform\?: 'fathom' \| 'fathom-paste' \| 'zoom'/,
    );
  });

  it("accepts current registry-backed connector sources", () => {
    const platforms: MeetingSourcePlatform[] = [
      "fathom",
      "read-ai",
      "grain",
      "fathom-paste",
    ];

    expect(platforms).toEqual([
      "fathom",
      "read-ai",
      "grain",
      "fathom-paste",
    ]);
  });
});
