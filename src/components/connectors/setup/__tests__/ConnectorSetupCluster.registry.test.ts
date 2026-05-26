import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/connectors/setup/ConnectorSetupCluster.tsx"),
  "utf8",
);

describe("ConnectorSetupCluster setup metadata ownership", () => {
  it("uses adapter setup metadata directly instead of local provider fallbacks", () => {
    expect(source).toMatch(/const setup = adapter\.setup/);
    expect(source).not.toMatch(/getFallbackSetupConfig/);
    expect(source).not.toMatch(/adapter\.metadata\.sourceApp === "plaud"/);
  });
});
