import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/onboarding/OnboardingModal.tsx"),
  "utf8",
);

describe("OnboardingModal connector registry wiring", () => {
  it("renders first-run connector choices from onboarding-capable adapters", () => {
    expect(source).toMatch(/ONBOARDING_CONNECTORS\.map/);
    expect(source).toMatch(/@\/lib\/onboarding-connectors/);
    expect(source).not.toMatch(/wizard=fathom/);
    expect(source).not.toMatch(/Connect Fathom/);
    expect(source).not.toMatch(/Connect Zoom/);
  });

  it("deep-links connector choices into the unified import source flow", () => {
    expect(source).toMatch(/\/import\?source=/);
    expect(source).toMatch(/encodeURIComponent\(adapter\.metadata\.sourceApp\)/);
  });

  it("does not contain visible recording-file import cues", () => {
    expect(source).not.toMatch(/File Upload/);
    expect(source).not.toMatch(/Upload a recording/);
    expect(source).not.toMatch(/audio|video|transcription/i);
  });
});
