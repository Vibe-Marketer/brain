import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/services/import-sources.service.ts"),
  "utf8",
);

describe("retryFailedImport connector dispatch", () => {
  it("uses the shared connector sync function contract", () => {
    expect(source).toMatch(/getConnectorSyncFunctionName\(sourceApp\)/);
    expect(source).toMatch(/canRetryFailedImport\(sourceApp\)/);
    expect(source).toMatch(
      /@\/lib\/connector-sync-functions/,
    );
    expect(source).not.toMatch(/CONNECTOR_SYNC_FUNCTIONS/);
    expect(source).not.toMatch(/edgeFunctionMap/);
    expect(source).not.toMatch(/sourceApp === "file-upload"/);
    expect(source).toMatch(/body:\s*\{\s*singleCallId:\s*failedExternalId\s*\}/);
  });
});
