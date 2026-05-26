import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const paneSource = readFileSync(
  join(process.cwd(), "src/components/panes/ImportSourcePane.tsx"),
  "utf8",
);

describe("ImportSourcePane source registry wiring", () => {
  it("derives primary import sources from the canonical source registry", () => {
    expect(paneSource).toMatch(/SOURCE_REGISTRY\.map/);
    expect(paneSource).not.toMatch(/const PRIMARY_SOURCES:\s*SourceDef\[\]\s*=\s*\[/);
  });

  it("uses shared connector availability for always-available import sources", () => {
    expect(paneSource).toMatch(/isConnectorAlwaysAvailable/);
    expect(paneSource).not.toMatch(/id !== 'file-upload'/);
    expect(paneSource).not.toMatch(/id === 'file-upload'/);
  });

  it("does not keep local coming-soon state for registry sources", () => {
    expect(paneSource).not.toMatch(/comingSoon/);
    expect(paneSource).not.toMatch(/disabled=\{comingSoon\}/);
  });
});
