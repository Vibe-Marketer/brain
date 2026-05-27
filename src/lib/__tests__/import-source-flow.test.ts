import { describe, expect, it } from "vitest";
import {
  getImportSourceFlow,
  isConnectorWizardImportSource,
  isSelectableImportSource,
} from "@/lib/import-source-flow";

describe("import source flow", () => {
  it.each([
    ["fathom", "connector-wizard"],
    ["zoom", "connector-wizard"],
    ["fireflies", "connector-wizard"],
    ["read-ai", "connector-wizard"],
    ["grain", "connector-wizard"],
    ["plaud", "connector-wizard"],
    ["youtube", "public-url"],
    ["file-upload", "unknown"],
    ["paste-transcript", "paste-transcript"],
    ["routing-rules", "routing-rules"],
    ["import-history", "import-history"],
    ["unknown", "unknown"],
  ])("maps %s to %s", (source, flow) => {
    expect(getImportSourceFlow(source)).toBe(flow);
  });

  it("identifies connector-wizard sources from source metadata", () => {
    expect(isConnectorWizardImportSource("read-ai")).toBe(true);
    expect(isConnectorWizardImportSource("grain")).toBe(true);
    expect(isConnectorWizardImportSource("youtube")).toBe(false);
    expect(isConnectorWizardImportSource("file-upload")).toBe(false);
  });

  it("marks only known import navigation sources as selectable", () => {
    expect(isSelectableImportSource("fathom")).toBe(true);
    expect(isSelectableImportSource("routing-rules")).toBe(true);
    expect(isSelectableImportSource("import-history")).toBe(true);
    expect(isSelectableImportSource("file-upload")).toBe(false);
    expect(isSelectableImportSource("unknown")).toBe(false);
  });
});
