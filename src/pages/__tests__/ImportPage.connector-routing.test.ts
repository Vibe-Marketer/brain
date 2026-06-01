import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/pages/ImportPage.tsx"), "utf8");
const emptyStateSource = readFileSync(
  join(process.cwd(), "src/components/transcript-library/EmptyStates.tsx"),
  "utf8",
);
const importHistorySource = readFileSync(
  join(process.cwd(), "src/components/import/ImportHistoryPanel.tsx"),
  "utf8",
);

describe("ImportPage connector routing", () => {
  it("routes native authenticated connectors through the unified connector import wizard", () => {
    expect(source).toMatch(/isConnectorWizardImportSource\(selectedSource\)/);
    expect(source).toMatch(/ConnectorImportWizard/);
  });

  it("selects the returned source after OAuth connection redirects back to import", () => {
    expect(source).toMatch(/isSelectableImportSource\(connectedSource\)/);
    expect(source).toMatch(/setSelectedSource\(connectedSource\)/);
    expect(source).toMatch(/const storedContext = readFirstRunContext\(\)/);
    expect(source).toMatch(/params\.get\("source"\) \?\? storedContext\?\.source/);
    expect(source).toMatch(/nextSearch\.delete\(consumedKey\)/);
    expect(source).toMatch(/invalidateConnectorQueries\(queryClient,\s*connectedSource\)/);
    expect(source).toMatch(/getImportSourceFlow\(selectedSource\)/);
  });

  it("can deep-link directly to a source without requiring an OAuth return", () => {
    expect(source).toMatch(/if \(connectedSource && isSelectableImportSource\(connectedSource\)\)/);
    expect(source).toMatch(/setSelectedSource\(connectedSource\)/);
  });

  it("does not auto-import historical calls on OAuth return", () => {
    expect(source).not.toMatch(/getConnectorSyncFunctionName\(connectedSource\)/);
    expect(source).not.toMatch(/supabase\.functions\.invoke/);
    expect(source).toMatch(/Choose calls to sync/);
  });

  it("does not route users into the hidden file-upload dropzone", () => {
    expect(source).not.toMatch(/FileUploadDropzone/);
    expect(source).not.toMatch(/sourceFlow === "file-upload"/);
    expect(source).not.toMatch(/audio or video files directly/);
    expect(emptyStateSource).not.toMatch(/upload a file directly/i);
    expect(importHistorySource).not.toMatch(/audio or video files directly/i);
    expect(importHistorySource).not.toMatch(/upload a file directly/i);
  });

  it("uses Import Transcript language for the manual transcript path", () => {
    expect(source).toMatch(/sourceFlow === "paste-transcript"/);
    expect(source).toMatch(/label="Import Transcript"/);
    expect(source).toMatch(/<PasteTranscriptModal[\s\S]*inline/);
    expect(source).not.toMatch(/setPasteModalOpen/);
    expect(source).not.toMatch(/Save Transcript/);
    expect(source).not.toMatch(/Paste Transcript/);
  });
});
