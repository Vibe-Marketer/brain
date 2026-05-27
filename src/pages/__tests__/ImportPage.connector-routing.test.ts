import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/pages/ImportPage.tsx"), "utf8");

describe("ImportPage connector routing", () => {
  it("routes native authenticated connectors through the unified connector import wizard", () => {
    expect(source).toMatch(/isConnectorWizardImportSource\(selectedSource\)/);
    expect(source).toMatch(/ConnectorImportWizard/);
  });

  it("selects the returned source after OAuth connection redirects back to import", () => {
    expect(source).toMatch(/isSelectableImportSource\(connectedSource\)/);
    expect(source).toMatch(/setSelectedSource\(connectedSource\)/);
    expect(source).toMatch(/invalidateConnectorQueries\(queryClient,\s*connectedSource\)/);
    expect(source).toMatch(/getImportSourceFlow\(selectedSource\)/);
  });

  it("can deep-link directly to a source without requiring an OAuth return", () => {
    expect(source).toMatch(/if \(!wasConnected\)/);
    expect(source).toMatch(/setSelectedSource\(connectedSource\)/);
  });

  it("uses centralized connector sync function dispatch after OAuth return", () => {
    expect(source).toMatch(/getConnectorSyncFunctionName\(connectedSource\)/);
    expect(source).not.toMatch(/syncFnMap/);
    expect(source).not.toMatch(/connectedSource === "fathom"/);
  });

  it("does not route users into the hidden file-upload dropzone", () => {
    expect(source).not.toMatch(/FileUploadDropzone/);
    expect(source).not.toMatch(/sourceFlow === "file-upload"/);
    expect(source).not.toMatch(/audio or video files directly/);
  });

  it("uses Import Transcript language for the manual transcript path", () => {
    expect(source).toMatch(/Import Transcript/);
    expect(source).not.toMatch(/Save Transcript/);
    expect(source).not.toMatch(/Paste Transcript/);
  });
});
