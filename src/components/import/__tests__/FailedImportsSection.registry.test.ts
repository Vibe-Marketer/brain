import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/import/FailedImportsSection.tsx"),
  "utf8",
);

describe("FailedImportsSection connector retry contract", () => {
  it("uses shared source labels and retryability", () => {
    expect(source).toMatch(/getSourceLabel\(item\.source_app\)/);
    expect(source).toMatch(/canRetryFailedImport\(item\.source_app\)/);
    expect(source).not.toMatch(/SOURCE_LABELS/);
    expect(source).not.toMatch(/item\.source_app === 'file-upload'/);
  });
});
