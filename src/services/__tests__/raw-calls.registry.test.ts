import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/services/raw-calls.service.ts"),
  "utf8",
);

describe("raw calls service registry wiring", () => {
  it("uses a query config map instead of branching per source", () => {
    expect(source).toMatch(/RAW_CALL_QUERY_CONFIG/);
    expect(source).toMatch(/fetchRawCallData\(recordingId, RAW_CALL_QUERY_CONFIG\[sourceApp\]\)/);
    expect(source).not.toMatch(/switch \(sourceApp\)/);
    expect(source).not.toMatch(/case 'fathom'/);
    expect(source).not.toMatch(/case 'zoom'/);
  });

  it("keeps raw detail support discoverable through a shared predicate", () => {
    expect(source).toMatch(/export function supportsRawCallData/);
    expect(source).toMatch(/sourceApp in RAW_CALL_QUERY_CONFIG/);
  });
});
