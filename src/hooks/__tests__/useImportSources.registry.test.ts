import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/hooks/useImportSources.ts"),
  "utf8",
);

describe("useImportSources connector cache invalidation", () => {
  it("uses shared connector status invalidation for source active toggles and disconnects", () => {
    expect(source).toMatch(/invalidateConnectorQueries\(queryClient\)/);
    expect(source).not.toMatch(/onSuccess:\s*\(\)\s*=>\s*\{\s*queryClient\.invalidateQueries\(\{\s*queryKey:\s*queryKeys\.imports\.sources\(\)\s*\}\)/);
  });

  it("refreshes call-list and import caches after failed-import retry starts", () => {
    expect(source).toMatch(/invalidateCallListCaches\(queryClient\)/);
    expect(source).toMatch(/queryKeys\.imports\.failed\(\)/);
    expect(source).toMatch(/queryKeys\.imports\.sources\(\)/);
    expect(source).toMatch(/queryKeys\.imports\.counts\(\)/);
  });
});
