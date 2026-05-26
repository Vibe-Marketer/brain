import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("WorkspaceSelector connector registry wiring", () => {
  it("uses registry-derived source ids for per-source workspace defaults", () => {
    const selectorSource = read("src/components/workspace/WorkspaceSelector.tsx");
    const preferencesSource = read("src/hooks/useUserPreferences.ts");

    expect(selectorSource).toMatch(/import type \{ SourceId \}/);
    expect(selectorSource).toMatch(/integration: SourceId/);
    expect(selectorSource).not.toMatch(/type IntegrationKey =/);

    expect(preferencesSource).toMatch(/import type \{ SourceId \}/);
    expect(preferencesSource).toMatch(
      /defaultImportWorkspace: Partial<Record<SourceId, string>>/,
    );
    expect(preferencesSource).not.toMatch(/type IntegrationKey =/);
  });
});
